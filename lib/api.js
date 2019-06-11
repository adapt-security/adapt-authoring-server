const { App, Utils } = require('adapt-authoring-core');
const Logger = require('adapt-authoring-logger');
/**
* Class to encapsulate a public-facing API
*/
class Api {
  /**
  * @constructor
  * @param {String} route Route to mount API at
  * @param {Router} router Router to handle requests
  */
  constructor(route, router) {
    /**
    * The route the API is mounted at
    * @type {String}
    */
    this.route = '';
    /**
    * API router instance
    * @type {express~Router}
    */
    this.router = {};
    /**
    * Routes config
    * @type {Array<Object>}
    */
    this.routes = [];
    /**
    * Middleware stack for the API
    * @type {Array<Function>}
    */
    this.middleware = [];

    Utils.defineGetter(this, { route, router });

    /** @ignore */this._initialised = false;
  }
  /**
  * Adds middleware to the API stack
  * @param {Array<Function>} middleware Middleware to be added
  * @return {Api} This instance, for chaining
  */
  setMiddleware(middleware) {
    if(!middleware) {
      return this;
    }
    if(this._initialised) {
      this.log('warn', 'cannot set middleware, API has already been initialised');
      return this;
    }
    if(this.middleware.length) {
      this.log('warn', 'middleware has already been set');
      return this;
    }
    Utils.defineGetter(this, 'middleware', middleware);
    return this;
  }
  /**
  * Store route definitions
  * @param {Array<Object>} routes Config of routes to be added
  * @return {Api} This instance, for chaining
  */
  setRoutes(routes) {
    if(this._initialised) {
      this.log('warn', 'cannot set routes, API has already been initialised');
      return this;
    }
    if(this.routes.length) {
      this.log('warn', 'routes have already been set');
      return this;
    }
    Utils.defineGetter(this, 'routes', routes);
    return this;
  }
  /**
  * Initialises the API
  */
  init() {
    if(this.middleware.length) {
      this.router.use(...this.middleware);
    }
    if(this.routes.length) {
      this.routes.forEach(r => {
        Object.entries(r.handlers).forEach(([method, handlers]) => {
          this.log('debug', `added ${method.toUpperCase()} ${this.route}${r.route}`);
          if(Array.isArray(handlers)) {
            return this.router[method](r.route, ...handlers);
          }
          this.router[method](r.route, handlers);
        });
      });
    }
    this._initialised = true;
  }
  /**
  * Logs a message
  * @param {String} level Level of log
  * @param {...*} args Arguments to be logged
  */
  log(level, ...args) {
    Logger.log(level, `${this.constructor.name.toLowerCase()}`, ...args);
  }
}

module.exports = Api;
