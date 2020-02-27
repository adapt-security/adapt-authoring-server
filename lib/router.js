const _ = require('lodash');
const { App } = require('adapt-authoring-core');
const express = require('express');
const ServerUtils = require('./serverUtils');
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
    * Middleware stack for the router
    * @type {Array<Function>}
    */
    this.middleware = [this.extendRequestData.bind(this)];

    /** @ignore */this._initialised = false;
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
      return `${serverUrl}${this.path}`;
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
    if(!func || !func.length) {
      return this;
    }
    this.checkHasInited(`${this.t('error.routeralreadyinited')}, ${this.t('error.middlewaremaynotbecalled')}`);
    this.middleware.push(...func.filter(_.isFunction));
    return this;
  }
  /**
  * Store route definition. Accepts multiple params.
  * @param {...Route} route Config of route(s) to be added
  * @return {AbstractApiModule} This instance, for chaining
  */
  addRoute(...route) {
    const inited = this.checkHasInited(`${this.t('error.routeralreadyinited')}, ${this.t('error.nomoreroutes')} (${this.path}${route.map(r => r.route).join(', ')})`);
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
    if(this.checkHasInited(`${this.t('error.routeralreadyinited')}, ${this.t('error.nomorechildrouters')} (${this.path}/${route})`)) {
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
    if(this.checkHasInited(`${this.t('error.routeralreadyinited')} (${this.path})`)) {
      return;
    }
    if(this.middleware.length) {
      this.expressRouter.use(...this.middleware);
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
          this.log('debug', this.t('info.addroute', { method: method.toUpperCase(), route: this.path+r.route }));
          this.expressRouter[method](r.route, this.invokeRequestHook, handler);
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
  * Middleware wrapper for each request. Allows hook listeners to be invoked.
  */
  extendRequestData(req, res, next) {
    function sendError(statusCode, error) {
      let message = this.app.lang.t('error.genericrequesterror');
      if(_.isString(error)) {
        message = error;
      } else if(_.isString(error.message)) {
        message = error.message;
      }
      this.status(statusCode || res.StatusCodes.Error.Default).json({ message });
    }
    res.StatusCodes = ServerUtils.StatusCodes;
    res.sendError = sendError.bind(res);
    next();
  }
  /**
  * Middleware to invoke request hook listeners
  */
  async invokeRequestHook(req, res, next) {
    try {
      const server = await App.instance.waitForModule('server');
      await server.requestHook.invoke(req);
      next();
    } catch(e) {
      next(e);
    }
  }
  /**
  * Shortcut for checking Router has initialised, logging a warning if not
  * @param {String} errorMessage Message to log on error
  * @return {Boolean}
  */
  checkHasInited(errorMessage) {
    if(this._initialised) {
      this.log('warn', errorMessage);
      console.trace(errorMessage);
    }
    return this._initialised;
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
