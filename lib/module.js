const express = require('express');
const { Module, Responder, Utils } = require('adapt-authoring-core');

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
    /**@ignore*/ this.__middleware = [];
    /**@ignore*/ this.__apiMiddleware = [];
    /**@ignore*/ this.__routers = [];
    /**@ignore*/ this.__apiRouters = [];
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
    /**
    * Main router to handle root (/) requests
    * @type {express~Router}
    */
    this.router = express.Router();
    /**
    * Router to handle API requests
    * @type {express~Router}
    */
    this.apiRouter = express.Router();
  }
  /**
  * Sets default values on the Express server
  */
  setDefaults() {
    this.expressApp.set('view engine', 'hbs');
    this.expressApp.set('x-powered-by', false);
  }
  /**
  * Adds middleware to the main server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {...function} func Callback function(s) to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addMiddleware(...func) {
    func.forEach(f => {
      if(typeof f !== 'function') {
        return;
      }
      this.__middleware.push(f);
      this.router.use(f);
    });
  }
  /**
  * Adds middleware to the api server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {...function} func Callback function(s) to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addApiMiddleware(...func) {
    func.forEach(f => {
      if(typeof f !== 'function') {
        return;
      }
      this.__apiMiddleware.push(f);
      this.apiRouter.use(f);
    });
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
    const router = express.Router();
    const parentRouter = isApi ? this.apiRouter : this.router;
    const arr = isApi ? this.__apiRouters : this.__routers;

    arr.push({ route, router });
    parentRouter.use(route, router);

    this.log('debug', `added${isApi ? ' API ' : ' '}router at ${route}`);

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
  * Starts the server
  * @param {Module} app App instance
  * @param {Function} resolve Function to call on fulfilment
  * @param {Function} reject Function to call on rejection
  */
  boot(app, resolve, reject) {
    this.use('/', this.router);
    this.router.use('/api', this.apiRouter);

    this.apiRouter.get('/', (req, res, next) => res.status(200).json(this.generateApiMap(req)));

    this.listen(PORT, () => {
      this.use(this.handleUncaughtError.bind(this));
      this.log('info', `listening on ${PORT}`);
      resolve();
    });
  }
  /**
  * Generates a map of the API endpoints for consumers
  * @param {ClientRequest} req Request object
  * @return {Object} Map of API endpoints
  */
  generateApiMap(req) {
    return this.__apiRouters.reduce((memo, r) => {
      const id = `${r.route.replace('/','')}_url`;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}${r.route.slice(1)}`;
      memo[id] = url;
      return memo;
    }, {});
  }
  /**
  * Handles any errors uncaught by other modules or middleware
  * @param {Error} error The error
  * @param {ClientRequest} req The client request object
  * @param {ServerResponse} res The server response object
  * @param {function} next The next middleware function in the stack
  */
  handleUncaughtError(error, req, res, next) {
    this.log('error', `Server: uncaught error thrown from route '${req.url}' - ${error.message || error}`);
    this.log('debug', error.stack);
    new Responder(res).error(error);
  }
}

module.exports = Server;
