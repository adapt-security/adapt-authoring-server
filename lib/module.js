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
    this.__apiMiddleware = [];
    this.__routers = [];
    this.__apiRouters = [];
    // create server application
    // TODO this public getter might not be needed...
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

    this.setDefaults();
    // store a reference on the main app
    app.server = this;
  }
  /**
  * Sets default values on the Express server
  */
  setDefaults() {
    this.expressApp.set('view engine', 'hbs');
    this.expressApp.set('x-powered-by', false);
  }
  /** @ignore */
  __addMiddleware(func, arr) {
    if(typeof func !== 'function') {
      return;
    }
    arr.push(func);
    if(this.hasBooted) this.use(func);
  }
  /**
  * Adds middleware to the main server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {function} func Callback function to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addMiddleware(...func) {
    func.forEach(f => this.__addMiddleware(f, this.__middleware));
  }
  /**
  * Adds middleware to the api server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {function} func Callback function to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addApiMiddleware(...func) {
    func.forEach(f => this.__addMiddleware(f, this.__apiMiddleware));
  }
  /**
  * Creates and adds a sub-router to the main server.
  * @param {string} route The route to listen on
  * @param {boolean} isApi whether the router should be treated as an API
  * @return {express~Router} The new router instance
  */
  createRouter(route, isApi=false) {
    if(this.hasBooted) {
      return this.log('error', 'must call createRouter before server boot');
    }
    var router = express.Router();

    if(isApi) {
      this.__apiRouters.push({ route, router });
    } else {
      this.__routers.push({ route, router });
    }
    return router;
  }

  /**
  * Creates and adds an API router to the main server.
  * @param {string} route The route to listen on
  * @return {express~Router} The new router instance
  */
  createApiRouter(route) {
    return this.createRouter(route, true);
  }

  /**
  * Adds any preloaded middleware/routers to the stack and starts the server.
  */
  boot(app, resolve, reject) {
    const m = middleware(this);
    const api = this.createRouter('/api');

    api.get('/', (req, res, next) => res.status(200).json(generateApiMap(req)));
    
    this.use(...m.preBoot, ...this.__middleware);


    this.__apiRouters.map(item => {
      api.use(item.route, item.router);
      this.log('debug', `added API router at ${item.route}`);
    });

    this.__routers.map(item => {
      this.use(item.route, item.router);
      this.log('debug', `added router at ${item.route}`);
    });

    this.listen(PORT, () => {
      this.use(...m.postBoot);
      this.log('info', `listening on ${PORT}`);
      resolve();
    });
  }
  /**
  * Generates a map of the API endpoints for consumers
  * @return {Object} Map of API endpoints
  */
  generateApiMap(req) {
    return this.__apiRouters.reduce((memo, r) => {
      const id = `${r.route.replace('/','')}_url`;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl.substr(0,-1)}${r.route}`;
      memo[id] = url;
      return memo;
    }, {});
  }
}

module.exports = Server;
