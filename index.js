const modules = require('./package.json').dependencies;

function loadModules() {
  return new Promise(function(resolve, reject) {
    console.log(modules);
  });
}

module.exports = {
  loadModules
};
