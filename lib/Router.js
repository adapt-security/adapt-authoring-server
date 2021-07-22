const _ = require('lodash');
const { App } = require('adapt-authoring-core');
const express = require('express');
const ServerUtils = require('./ServerUtils');
/**
 * Handles the Express routing functionality
 */
class Router {
  /**
   * If passing an {@link express~Router} as the parentRouter, it is assumed that the Express Router is the top of the router 'heirarchy' (which will have an impact of some of the {@link Router} methods)
   * @param {String} route Route to mount API at
   * @param {Router|express~Router} parentRouter Parent to mount router
   */
  constructor(route, parentRouter) {
    /**
     * The route the router will be mounted at
     * @type {String}
     */
    this.route = route;
    /**
     * Routes config
     * @type {Array<Route>}
     */
    this.routes = [];
    /**
     * Express router instance
     * @type {express~Router}
     */
    this.expressRouter = express.Router();
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
     * Middleware stack to be added directly to the router
     * @type {Array<Function>}
     */
    this.routerMiddleware = [];
    /**
     * Middleware stack to be added before route handlers (useful if you need access to specific request attributes that don't exist when standard middleware runs)
     * @type {Array<Function>}
     */
    this.handlerMiddleware = [];

    /** @ignore */this._initialised = false;
  }
  /**
   * Returns the map of routes attached to this router
   * @type {Object}
   */
  get map() {
    return ServerUtils.generateRouterMap(this);
  }
  /**
   * Generates this router's path from its ancestors
   * @type {String}
   */
  get path() {
    let p = '';

    if(_.isString(this.parentRouter.path)) {
      p += this.parentRouter.path;
    }
    if(p[p.length-1] !== '/' && this.route[0] !== '/') {
      p += '/';
    }
    return p + this.route;
  }
  /**
   * Returns the URL for the router
   * @type {String} The URL
   */
  get url() {
    try {
      const serverUrl = App.instance.dependencyloader.instances['adapt-authoring-server'].url;
      return serverUrl + this.path;
    } catch(e) {
      this.log('error', e);
      return '';
    }
  }
  /**
   * Adds middleware to the router stack. Accepts multiple params.
   * @param {...Function} func Middleware function(s) to be added
   * @return {AbstractApiModule} This instance, for chaining
   * @see https://expressjs.com/en/guide/using-middleware.html
   */
  addMiddleware(...func) {
    return this._addMiddleware(this.routerMiddleware, ...func);
  }
  /**
   * Adds middleware to be called prior to any route handlers. Accepts multiple params. Useful if you need access to specific request attributes that don't exist when standard middleware runs.
   * @param {...Function} func Middleware function(s) to be added
   * @return {AbstractApiModule} This instance, for chaining
   * @see https://expressjs.com/en/guide/using-middleware.html
   */
  addHandlerMiddleware(...func) {
    return this._addMiddleware(this.handlerMiddleware, ...func);
  }
  /** @ignore */ _addMiddleware(stack, ...func) {
    if(func.length) {
      this.warnOnInited('middleware may not be called before any route handlers');
      stack.push(...func.filter(_.isFunction));
    }
    return this;
  }
  /**
   * Recursively gets middleware of the current router heirarchy
   * @return {Array<Function>}
   */
  getHandlerMiddleware() {
    let middleware = [];
    let r = this;
    const _getMiddleware = () => {
      if(!(r instanceof Router)) {
        return;
      }
      middleware = [...r.handlerMiddleware, ...middleware];
      r = r.parentRouter;
      _getMiddleware();
    };
    _getMiddleware();
    return middleware;
  }
  /**
   * Store route definition. Accepts multiple params.
   * @param {...Route} route Config of route(s) to be added
   * @return {AbstractApiModule} This instance, for chaining
   */
  addRoute(...route) {
    const inited = this.warnOnInited(`cannot set further routes (${this.path} ${route.map(r => r.route).join(', ')})`);
    if(!inited && route.length) {
      this.routes.push(...route.filter(this.validateRoute, this));
    }
    return this;
  }
  /**
   * Function for filtering bad route configs
   * @param {Route} r Route config
   * @return {Boolean}
   */
  validateRoute(r) {
    const app = App.instance;
    const ePrefix = app.lang.t('error.invalidroute', { route: this.route });
    if(!_.isString(r.route)) {
      this.log('warn', `${ePrefix}, ${app.lang.t('error.routenotstring')}`);
      return false;
    }
    if(!r.handlers) {
      this.log('warn', `${ePrefix}, ${app.lang.t('error.nohandlers')}`);
      return false;
    }
    // handlers can be single function or array of functions
    const allHandlersFuncs = Object.entries(r.handlers).every(([m,h]) => {
      if(this.expressRouter[m] === undefined) {
        this.log('warn', `${ePrefix}, ${app.lang.t('error.invalidexpressfunction', { func: m })}`);
        return false;
      }
      if(!_.isFunction(h) && !(_.isArray(h) && h.every(_.isFunction))) {
        this.log('warn', `${ePrefix} ${m.toUpperCase()} ${r.route}, ${app.lang.t('error.handlersnotfuncs')}`);
        return false;
      }
      return true;
    });
    if(!allHandlersFuncs) {
      return false;
    }
    return true;
  }
  /**
   * Creates and adds a sub-router to this router.
   * @param {string} route The route to mount child router to
   * @return {Router} The new router instance
   */
  createChildRouter(route) {
    if(this.warnOnInited(`cannot create further child routers (${this.path}/${route})`)) {
      return this;
    }
    const router = new Router(route);

    router.parentRouter = this;
    this.childRouters.push(router);

    this.log('debug', this.t('info.addrouter', { path: router.path }));

    return router;
  }
  /**
   * Initialises the API
   */
  init() {
    if(this.warnOnInited(`(${this.path})`)) {
      return;
    }
    if(this.routerMiddleware.length) {
      this.expressRouter.use(...this.routerMiddleware);
    }
    if(this.childRouters.length) {
      this.childRouters.forEach(r => {
        r.init();
        this.expressRouter.use(r.route, r.expressRouter);
      });
    }
    if(this.routes.length) {
      this.routes.forEach(r => {
        Object.entries(r.handlers).forEach(([method, handler]) => {
          this.log('debug', this.t('info.addroute', {
            method: method.toUpperCase(),
            route: `${this.path !== '/' ? this.path : ''}${r.route}`
          }));
          this.expressRouter[method](r.route, ServerUtils.addExistenceProps, ...this.getHandlerMiddleware(), handler);
        });
      });
    }
    // add to the parent stack
    if(this.parentRouter instanceof Router) {
      this.parentRouter.expressRouter.use(`/${this.route}`, this.expressRouter);
    } else {
      const route = this.route[0] !== '/' ? `/${this.route}` : this.route;
      this.parentRouter.use(route, this.expressRouter);
    }
    this._initialised = true;
  }
  /**
   * Shortcut for checking Router has initialised, logging a warning if not
   * @param {String} message Message to log on error
   * @return {Boolean}
   */
  warnOnInited(message) {
    if(this._initialised) {
      this.log('warn', `router has already initialised, ${message}`);
    }
    return this._initialised;
  }
  /**
   * Creates an array defining the router inheritance hierarchy
   * @param {Router} router The root router
   * @return {Array}
   */
  flattenRouters(router = this) {
    return router.childRouters.reduce((a,c) => {
      c.childRouters ? a.push(...this.flattenRouters(c)) : a.push(c);
      return a;
    }, [router]);
  }
  /**
   * Logs a message
   * @param {String} level Level of log
   * @param {...*} args Arguments to be logged
   */
  log(level, ...args) {
    App.instance.logger.log(level, this.constructor.name.toLowerCase(), ...args);
  }
  /**
   * Translates a string using the lang module
   * @param {String} key Key of language string
   * @param {Object} data Data to be passed to the translate function
   * @return {String}
   */
  t(key, data) {
    return App.instance.lang.t(key, data);
  }
}

module.exports = Router;
