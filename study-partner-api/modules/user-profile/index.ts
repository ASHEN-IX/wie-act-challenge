// Public module contract; lifecycle is owned by the main API.
const userProfileModule = {
  get app() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./src/app');
  }
};

export default userProfileModule;
module.exports = userProfileModule;
