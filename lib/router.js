const { App, Responder, Utils } = require('adapt-authoring-core');
const express = require('express');
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
    this.middleware = [];

    /** @ignore */this._initialised = false;
  }
  /**
  * Generates this router's path from its ancestors
  * @type {String}
  */
  get path() {
    let p = '';

    if(Utils.isString(this.parentRouter.path)) {
      p += this.parentRouter.path;
    }
    if(p[p.length-1] !== '/' && this.route[0] !== '/') {
      p += '/';
    }
    return p + this.route;
  }
  /**
  * Generates a map of available routers
  * @type {String}
  */
  get map() {
    return this.childRouters
      .sort((a,b) => a.route.localeCompare(b.route))
      .reduce((m,c) => Object.assign(m, c.map), { [`${this.route}_url`]: `${this.url}` });
  }
  /**
  * Returns the URL for the router
  * @return {String} The URL
  */
  get url() {
    return `${App.instance.getModule('server').url}${this.path}`;
  }
  /**
  * Enables the router map via the API
  */
  enableAPIMap() {
    if(this._initialised) {
      return this.log('warn', `${this.t('error.routeralreadyinited')}, ${this.t('error.noenablemap')}`);
    }
    this.addRoute({
      route: '/',
      handlers: { get: (req, res) => new Responder(res).success(this.map) }
    });
    // App.instance.auth.secureRoute(`${this.path}/`, 'GET', [`read:${this.route}`]);
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
    if(this._initialised) {
      this.log('warn', `${this.t('error.routeralreadyinited')}, ${this.t('error.middlewaremaynotbecalled')}`);
    }
    this.middleware.push(...func.filter(Utils.isFunction));
    return this;
  }
  /**
  * Store route definition. Accepts multiple params.
  * @param {...Route} route Config of route(s) to be added
  * @return {AbstractApiModule} This instance, for chaining
  */
  addRoute(...route) {
    if(this._initialised) {
      this.log('warn', `${this.t('error.routeralreadyinited')}, ${this.t('error.nomoreroutes')}`);
    } else if(route.length) {
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
    if(!Utils.isString(r.route)) {
      this.log('warn', `${ePrefix}, ${app.lang.t('error.routenotstring')}`);
      return false;
    }
    if(!r.handlers) {
      this.log('warn', `${ePrefix}, ${app.lang.t('error.nohandlers')}`);
      return false;
    }
    // handlers can be single function or array of functions
    const allHandlersFuncs = Object.entries(r.handlers).every(([m,h]) => {
      if(!Utils.isFunction(h) && !(Utils.isArray(h) && h.every(Utils.isFunction))) {
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
    if(this._initialised) {
      this.log('warn', `${this.t('error.routeralreadyinited')}, ${this.t('error.nomorechildrouters')}`);
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
    if(this._initialised) {
      return this.log('warn', this.t('error.routeralreadyinited'));
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
          this.expressRouter[method](r.route, this.handleRequest(), handler);
        });
      });
    }
    // add to the parent stack
    if(this.parentRouter instanceof Router) {
      this.parentRouter.expressRouter.use(`/${this.route}`, this.expressRouter);
    } else {
      const route = (this.route[0] !== '/') ? `/${this.route}` : this.route;
      this.parentRouter.use(route, this.expressRouter);
    }
    this._initialised = true;
  }
  /**
  * Middleware wrapper for each request. Allows hook listeners to be invoked.
  * @return {Function} A function to handle request
  */
  handleRequest() {
    return (req, res, next) => {
      App.instance.getModule('server').requestHook.invoke(req)
        .then((d) => {
          Object.assign(req, d);
          next();
        })
        .catch((e) => next(e));
    };
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
  */
  t(key, data) {
    return App.instance.lang.t(key, data);
  }
}

module.exports = Router;
