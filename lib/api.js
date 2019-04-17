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
    * @type {String} route
    */
    Utils.defineGetter(this, { route, router });
    /** @ignore */this._initialised = false;
  }
  /**
  * Adds middleware to the API stack
  * @param {Array[Function]} middleware Middleware to be added
  * @return {Api} This instance, for chaining
  */
  setMiddleware(middleware) {
    if(this._initialised) {
      return this.log('warn', 'cannot set middleware, API has already been initialised');
    }
    if(this.middleware) {
      return this.log('warn', 'middleware has already been set');
    }
    Utils.defineGetter(this, 'middleware', middleware);
    return this;
  }
  /**
  * Store route definitions
  * @param {Object} routes Middleware to be added
  * @return {Api} This instance, for chaining
  */
  setRoutes(routes) {
    if(this._initialised) {
      return this.log('warn', 'cannot set routes, API has already been initialised');
    }
    if(this.routes) {
      return this.log('warn', 'routes have already been set');
    }
    Utils.defineGetter(this, 'routes', routes);
    return this;
  }
  /**
  * Initialises the API
  */
  init() {
    if(this.middleware) {
      this.router.use(...this.middleware);
    }
    this.routes.forEach(r => {
      Object.entries(r.handlers).forEach(([method, handlers]) => {
        this.log('debug', `added ${method.toUpperCase()} ${this.route}${r.route}`);
        if(Array.isArray(handlers)) {
          return this.router[method](r.route, ...handlers);
        }
        this.router[method](r.route, handlers);
      });
    });
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
