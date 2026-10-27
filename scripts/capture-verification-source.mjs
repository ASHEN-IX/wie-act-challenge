// Identifies the dirty source bytes without copying secrets, datasets or logs.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, lstat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = [];
for (const name of [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0'))].sort()) {
  if (!name || name.startsWith('reports/') || /(^|\/)(\.env(?:\..*)?|uploads|faiss|var|node_modules)(\/|$)/.test(name)) continue;
  try {
    const filename = path.join(root, name), stat = await lstat(filename);
    if (stat.isFile()) files.push({ path: name, sha256: hash(await readFile(filename)) });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    files.push({ path: name, removed: true });
  }
}
const record = {
  capturedAt: new Date().toISOString(), head: git(['rev-parse', 'HEAD']).trim(),
  sourceDigest: hash(JSON.stringify(files)),
  exclusions: 'Reports/evidence, environment files, uploads, indexes, var and ignored files; no contents copied.',
  files
};
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(record, null, 2) + '\n');
console.log(`${record.head} + source sha256:${record.sourceDigest} (${files.length} files)`);
