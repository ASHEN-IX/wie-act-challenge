// Only creates/removes uniquely named disposable containers and volumes.
// No provider requests or production service changes are made.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const image = process.argv[2];
if (!image) throw new Error('Usage: node scripts/verify-ai-container.mjs <built-image>');
const prefix = `ednova-runtime-check-${randomUUID()}`;
const volumes = ['uploads', 'faiss', 'legacy'].map((name) => `${prefix}-${name}`);
const container = `${prefix}-http`;
const fixture = fileURLToPath(new URL('../apps/ai/tests/fixtures/container_artifact_smoke.py', import.meta.url));
const fixtureMount = ['--mount', `type=bind,src=${fixture},dst=/container-check.py,readonly`];
function docker(args, expected = 0) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 90000 });
  assert.equal(result.status, expected, `${args[0]}: ${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}
const env = [
  '-e', 'LLM_MOCK=1', '-e', 'LLM_APPROVALS_JSON={}',
  '-e', 'HF_HUB_OFFLINE=1', '-e', 'TRANSFORMERS_OFFLINE=1',
  '-e', 'LITELLM_LOCAL_MODEL_COST_MAP=True',
  '-e', 'INGEST_UPLOADS_DIR=/app/uploads', '-e', 'FAISS_INDEX_DIR=/app/faiss'
];
const mounts = (readOnly = false) => [
  '--mount', `type=volume,src=${volumes[0]},dst=/app/uploads${readOnly ? ',readonly' : ''}`,
  '--mount', `type=volume,src=${volumes[1]},dst=/app/faiss${readOnly ? ',readonly' : ''}`
];
try {
  assert.equal(docker(['image', 'inspect', image, '--format', '{{.Config.User}}']), '10001:10001');
  for (const volume of volumes) docker(['volume', 'create', volume]);
  console.log(docker(['run', '--rm', '--network', 'none', ...env, ...mounts(), ...fixtureMount,
    '-e', 'CHECK_MODE=write', image, 'python', '/container-check.py']));
  // Read-only consumers intentionally bypass the writer entrypoint's preflight.
  console.log(docker(['run', '--rm', '--network', 'none', '--entrypoint', 'python',
    ...env, ...mounts(true), ...fixtureMount, '-e', 'CHECK_MODE=read', image,
    '/container-check.py']));
  docker(['run', '--rm', '--network', 'none', '--user', '0:0', '--entrypoint', 'python',
    '--mount', `type=volume,src=${volumes[2]},dst=/app/uploads`, image, '-c',
    "import os,pathlib; p=pathlib.Path('/app/uploads'); (p/'sentinel').write_text('preserved'); os.chown(p,0,0); os.chmod(p,0o700)"]);
  const denied = spawnSync('docker', ['run', '--rm', '--network', 'none', ...env,
    '--mount', `type=volume,src=${volumes[2]},dst=/app/uploads`, image, 'true'], { encoding: 'utf8' });
  assert.equal(denied.status, 1);
  assert.match(denied.stderr, /Storage preflight failed for INGEST_UPLOADS_DIR/);
  assert.equal(docker(['run', '--rm', '--network', 'none', '--user', '0:0', '--entrypoint', 'python',
    '--mount', `type=volume,src=${volumes[2]},dst=/app/uploads`, image, '-c',
    "import os,pathlib; p=pathlib.Path('/app/uploads'); assert p.stat().st_uid==0; assert p.stat().st_mode & 0o777==0o700; print((p/'sentinel').read_text())"]), 'preserved');
  console.log('PASS: incompatible legacy mount refused; ownership, permissions and contents preserved');
  docker(['run', '-d', '--name', container, '--network', 'none', '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', ...env, ...mounts(), image]);
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    const probe = spawnSync('docker', ['exec', container, 'python', '-c',
      "import urllib.request; assert urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=2).status==200"], { encoding: 'utf8' });
    if (probe.status === 0) { healthy = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(healthy, 'Non-root HTTP service must become healthy with read-only application filesystem');
  console.log('PASS: non-root HTTP health with network disabled and read-only application filesystem');
} finally {
  spawnSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
  for (const volume of volumes) spawnSync('docker', ['volume', 'rm', volume], { stdio: 'ignore' });
}
