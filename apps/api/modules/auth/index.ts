// Public module contract; lifecycle is owned by the main API.
import app from './src/app';

export { app };
export default {
  get app() {
    return app;
  }
};
module.exports = {
  get app() {
    return app;
  }
};
