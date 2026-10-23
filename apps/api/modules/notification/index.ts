import app from './src/app';
import { attachRealtime } from './src/realtime';

export { app, attachRealtime };
export default {
  get app() {
    return app;
  },
  attachRealtime: (server: Parameters<typeof attachRealtime>[0]) => attachRealtime(server)
};
module.exports = {
  get app() {
    return app;
  },
  attachRealtime: (server: Parameters<typeof attachRealtime>[0]) => attachRealtime(server)
};
