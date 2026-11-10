// Serves the production build of apps/web on :3100 (equivalent to `next start`).
const path = require('node:path');
const http = require('node:http');

const dir = path.resolve(__dirname, '../../apps/web');
const next = require(require.resolve('next', { paths: [dir] }));
const app = next({ dir, dev: false, port: 3100, hostname: 'localhost' });

app.prepare().then(() => {
  const handle = app.getRequestHandler();
  http.createServer((req, res) => handle(req, res)).listen(3100, () => console.log('web ready on :3100'));
});
