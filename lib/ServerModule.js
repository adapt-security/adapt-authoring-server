const express = require('express');
const { AbstractModule, Hook } = require('adapt-authoring-core');
const Router = require('./Router');
const ServerUtils = require('./ServerUtils');
/**
 * Adds an Express server to the authoring tool
 * @extends {AbstractModule}
 */
class ServerModule extends AbstractModule {
  /** @override */
  async init() {
    /**
     * Local reference to HTTP status code reference
     * @type {Object}
     * @see ServerUtils#StatusCodes
     */
    this.StatusCodes = ServerUtils.StatusCodes;
    /**
     * The main Express Application
     * @type {express~App}
     */
    this.expressApp = express();
    /**
     * The default/'root' router for the application
     * @type {Router}
     */
    this.root = new Router('/', this.expressApp);
    this.root.addMiddleware(ServerUtils.extendRequestData.bind(this));
    /**
     * The router which handles all APIs
     * @type {Router}
     */
    this.api = new Router('api', this.root);
    this.api.addMiddleware(ServerUtils.extendRequestData.bind(this));
    /**
     * Hook for interrupting requests
     * @type {Hook}
     */
    this.requestHook = new Hook({ type: Hook.Types.Series, mutable: true });

    this.expressApp.set('view engine', 'hbs');
    this.expressApp.disable('x-powered-by');
    /**
     * Need to wait for other modules to load before we properly initialise &
     * start listening for incoming connections
     */
    this.setReady();
    this.app.onReady().then(() => this.start());
  }
  async start() {
    this.log('debug', this.app.lang.t('info.startingserver'));
    // Initialise the root router
    this.root.init();
    // Initialise the API router
    this.api.expressRouter.get('/', ServerUtils.mapHandler(this.api).bind(this));
    this.api.init();
    // add not-found handlers
    this.api.expressRouter.use(ServerUtils.apiNotFoundHandler.bind(this));
    this.root.expressRouter.use(ServerUtils.rootNotFoundHandler.bind(this));
    // add generic error handling
    this.expressApp.use(ServerUtils.apiGenericErrorHandler.bind(this));
    this.expressApp.use(ServerUtils.rootGenericErrorHandler.bind(this));

    this.listen(() => {
      this.log('info', this.app.lang.t('info.applistening', { port: this.port }));
      this.log('info', this.app.lang.t('info.appavailable', { url:  this.url }));
    });
  }
  /**
   * Port the app should listen on
   * @type {String}
   */
  get port() {
    return this.getConfig('port');
  }
  /**
   * The URL for the server from its config
   * @type {String}
   */
  get url() {
    return this.getConfig('url') || `${this.getConfig('host')}:${this.port}`;
  }
  /**
   * Middleware function to allow serving of static files
   * @see https://expressjs.com/en/4x/api.html#express.static
   * @param {String} root The root directory from which to serve static assets
   * @param {Object} options Options to pass to the function
   * @return {Function}
   */
  static(root, options) {
    return express.static(root, options);
  }
  /**
   * Start the Express server (shortcut to the Express function of the same name).
   * @see https://expressjs.com/en/4x/api.html#app.listen
   * @param {function} func Callback function to be called on connection.
   * @return {net~Server}
   */
  listen(func) {
    /**
     * Reference to the HTTP server used by Express
     * @type {net~Server}
     */
    this.httpServer = this.expressApp.listen(this.port, func);
    return this.httpServer;
  }
  /**
   * Stops the Express server
   * @param {function} cb Callback function to be called on close.
   */
  close(cb) {
    if(!this.httpServer) {
      this.log('warn', this.app.lang.t('error.noserver'));
      cb();
      return;
    }
    this.httpServer.close(() => {
      this.httpServer = undefined;
      this.log('info', this.app.lang.t('info.appstoplistening', { port: this.port }));
      cb();
    });
  }
}

module.exports = ServerModule;
