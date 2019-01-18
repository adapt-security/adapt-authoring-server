const express = require('express');
const middleware = require('./middleware');
const { Module, Utils } = require('adapt-authoring-core');

const PORT = 5000;

/**
* Adds an Express server to the authoring tool
*/
class Server extends Module {
  /**
  * @constructor
  * @param {App} app The main application instance
  */
  constructor(app, config) {
    super(app, config);
    this.__middleware = [];
    this.__routers = [];
    // create server application
    Utils.defineGetter(this, 'expressApp', express());
    /**
    * Add middleware to the Express server stack (shortcut to the Express function of the same name).
    * @see https://expressjs.com/en/4x/api.html#app.use
    * @param {express.Router} router A Router instance
    */
    this.use = this.expressApp.use.bind(this.expressApp);
    /**
    * Start the Express server (shortcut to the Express function of the same name).
    * @see https://expressjs.com/en/4x/api.html#app.listen
    * @param {number} port The port to listen on.
    * @param {function} func Callback function to be called on connection.
    */
    this.listen = this.expressApp.listen.bind(this.expressApp);
    // store a reference on the main app
    app.server = this;
  }
  /**
  * Adds middleware to the main server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {function} func Callback function to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addMiddleware(func) {
    this.__middleware.push(func);
    if(this.hasBooted) this.use(func);
  }
  /**
  * Creates and adds a sub-router to the main server.
  * @param {string} route The route to listen on
  * @return {express~Router} The new router instance
  */
  createRouter(route) {
    var router = express.Router();
    this.__routers.push({ route, router });
    if(this.hasBooted) this.use(route, router);
    return router;
  }

  /**
  * Adds any preloaded middleware/routers to the stack and starts the server.
  */
  boot(app, resolve, reject) {
    this.use(...middleware.preBoot, ...this.__middleware);
    this.__routers.map(item => this.use(item.route, item.router));
    this.listen(PORT, () => {
      this.use(...middleware.postBoot);
      console.log(`Server listening on ${PORT}`);
      resolve();
    });
  }
}

module.exports = Server;
