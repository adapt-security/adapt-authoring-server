const { Module } = require('adapt-authoring-core');
const express = require('express');
const middleware = require('./middleware');

class Server extends Module {
  constructor() {
    this.name = 'server';
  }

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
