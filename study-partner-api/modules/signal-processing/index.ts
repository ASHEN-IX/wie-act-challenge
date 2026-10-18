// Public module contract; lifecycle is owned by the main API.
module.exports = {
  get app() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./src/app');
  }
};
