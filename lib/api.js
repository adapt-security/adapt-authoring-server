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
    Object.entries(this.routes).forEach(route => {
      Object.entries(route[1]).forEach(method => {
        this.log('debug', `added ${method[0].toUpperCase()} ${this.route}${route[0] !== '/' ? route[0] : ''}`);
        if(!Array.isArray(method[1])) {
          return this.router[method[0]](route, method[1]);
        }
        this.router[method[0]](route, ...method[1]);
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
