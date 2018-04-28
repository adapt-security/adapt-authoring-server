const Module = require('adapt-authoring-core').DataTypes.Module;
const express = require('express');
const middleware = require('./middleware');

class Server extends Module {
  preload(app) {
    this.express_server = express();
    // shoercut to express function
    this.use = this.express_server.use;
    // let's use our shortcut
    this.use(middleware);
  }

  start() {
    this.express_server.listen(5000);
  }
}

module.exports = Server;
