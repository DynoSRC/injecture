const globalStore = require('./injecture-store');

module.exports = function clear() {
  Object.keys(globalStore).forEach(key => delete globalStore[key]);
};
