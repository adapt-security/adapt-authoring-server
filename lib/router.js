const { App, Utils } = require('adapt-authoring-core');
const express = require('express');
/**
* Class to encapsulate a public-facing API
* @todo generic error handling
*/
class Router {
  /**
  * @constructor
  * @param {String} route Route to mount API at
  * @param {Router|express~Router} parentRouter Parent to mount router
  */
  constructor(route, parentRouter) {
    const _router = express.Router();
    /**
    * The route the router will be mounted at
    * @type {String}
    */
    this.route = '';
    /**
    * Routes config
    * @type {Array<Object>}
    */
    this.routes = [];
    /**
    * Express router instance
    * @type {express~Router}
    */
    this._router = {};
    /**
    * Express router instance
    * @type {express~App|Router}
    */
    this.parentRouter = parentRouter;
    /**
    * List of sub-routers
    * @type {Array<Router>}
    */
    this.childRouters = [];
    /**
    * Middleware stack for the router
    * @type {Array<Function>}
    */
    this.middleware = [];

    Utils.defineGetter(this, { route, _router });

    /** @ignore */this._initialised = false;
  }
  /**
  * Generates this router's complete URL from its ancestors
  * @type {String}
  */
  get url() {
    let parentUrl;
    if(this.parentRouter instanceof Router) {
      parentUrl = this.parentRouter.url;
    } else { // assume app root
      const { aat_app_url, aat_server_host, aat_server_port } = App.instance.env;
      parentUrl = aat_app_url || `${aat_server_host}:${aat_server_port}`;
    }
    return parentUrl + this.route;
  }
  /**
  * Adds middleware to the router stack. Accepts multiple params.
  * @param {...Function} func Middleware function(s) to be added
  * @return {Api} This instance, for chaining
  * @see
  */
  addMiddleware(...func) {
    if(!func || !func.length) {
      return this;
    }
    if(this._initialised) {
      this.log('debug', 'Router has already initialised, middleware may not be called before any route handlers');
    }
    func.forEach(f => {
      if(typeof f !== 'function') this.middleware.push(f);
    });
    return this;
  }
  /**
  * Store route definition. Accepts multiple params.
  * @param {...Object} route Config of route(s) to be added
  * @return {Api} This instance, for chaining
  */
  addRoute(...route) {
    if(!route || !route.length) {
      return this;
    }
    if(this._initialised) {
      this.log('debug', 'Router has already initialised, cannot set further routes');
    }
    this.routes = this.routes.concat(route);

    return this;
  }
  /**
  * Add a sub-router
  * @param {Router} router The router to add
  * @return {Api} This instance, for chaining
  */
  addRouter(router) {
    if(!(router instanceof Router)) {
      this.log('debug', 'Expected an instance of Router');
      return this;
    }
    if(this._initialised) {
      this.log('debug', 'Router has already initialised, cannot set further routes');
      return this;
    }
    router.parentRouter = this;
    this.childRouters.push(router);

    return this;
  }
  /**
  * Initialises the API
  */
  init() {
    if(this._initialised) {
      return this.log('debug', 'Router has already initialised');
    }
    if(this.middleware.length) {
      this._router.use(...this.middleware);
    }
    if(this.childRouters.length) {
      this.childRouters.forEach(r => {
        r.init();
        this._router.use(r.route, r._router);
      });
    }
    if(this.routes.length) {
      this.routes.forEach(r => {
        Object.entries(r.handlers).forEach(([method, handler]) => {
          this.log('debug', `added ${method.toUpperCase()} ${this.route}${r.route}`);
          this._router[method](r.route, handler);
        });
      });
    }
    if(this.parentRouter instanceof Router) {
      this.parentRouter._router.use(`/${this.route}`, this._router);
    } else {
      const route = (this.route[0] !== '/') ? `/${this.route}` : this.route;
      this.parentRouter.use(route, this._router);
    }
    this._initialised = true;
  }
  /**
  * Logs a message
  * @param {String} level Level of log
  * @param {...*} args Arguments to be logged
  */
  log(level, ...args) {
    Utils.logMessage(level, this.constructor.name.toLowerCase(), ...args);
  }
}

module.exports = Router;
