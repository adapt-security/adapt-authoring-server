const Module = require('adapt-authoring-core').DataTypes.Module;
const express = require('express');
const middleware = require('./middleware');

class Server extends Module {
  preload(app) {
    return new Promise(function(resolve, reject) {
      this.express_server = express();
      // shoercut to express function
      this.use = this.express_server.use;
      // add the middleware specified in middleware.js
      this.use(middleware);

      resolve();
    });
  }

  boot(app) {
    return new Promise(function(resolve, reject) {
      var PORT = 5000;
      this.express_server.listen(PORT);
      console.log(`Server listening on ${PORT}`);
      resolve();
    });
  }
}

module.exports = Server;
