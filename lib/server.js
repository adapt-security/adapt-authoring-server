const Module = require('adapt-authoring-core').DataTypes.Module;
const express = require('express');
const middleware = require('./middleware');

const PORT = 5000;

class Server extends Module {
  constructor(app) {
    super();
    this.__middleware = [];
    this.__routers = [];
    // create server, but only expose some bits
    const expressApp = express();
    this.use = expressApp.use.bind(expressApp);
    this.listen = expressApp.listen.bind(expressApp);
    // store a reference on the main app
    app.server = this;
  }
  /**
  * Adds middleware to the main server.
  * You should call this function prior to server boot (i.e. during preload), so
  * you can be sure your middleware runs before any queued routers.
  */
  addMiddleware(func) {
    this.__middleware.push(func);
    if(this.hasBooted) this.use(func);
  }
  /**
  * Creates and adds a sub-router to the main server.
  */
  createRouter(route) {
    var router = express.Router();
    this.__routers.push({ route, router });
    if(this.hasBooted) this.use(router);
    return router;
  }

  boot(app, resolve, reject) {
    // Add all middleware we have so far, followed by routers
    this.use([...middleware, ...this.__middleware]);
    this.__routers.map((item) => this.use(item.route, item.router));

    this.listen(PORT, () => console.log(`Server listening on ${PORT}`));
    resolve();
  }

}

module.exports = Server;
