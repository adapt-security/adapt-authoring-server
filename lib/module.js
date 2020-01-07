const express = require('express');
const path = require('path');
const { AbstractModule, Hook, Responder, Utils } = require('adapt-authoring-core');
const Router = require('./router');
/**
* Adds an Express server to the authoring tool
* @extends {AbstractModule}
*/
class ServerModule extends AbstractModule {
  /**
  * Returns the URL for the server from its config
  * @return {String} The formatted URL
  */
  get url() {
    const url = this.getConfig('url');
    const host = this.getConfig('host');
    const port = this.getConfig('port');
    return url || `${host}:${port}`;
  }
  /**
  * @param {App} app The main application instance
  * @param {Object} config Module config
  */
  constructor(app, config) {
    super(app, config);
    /**
    * The main Express Application
    * @type {express~App}
    */
    this.expressApp = express();
    /**
    * Reference to the HTTP server used by Express
    * @type {net~Server}
    */
    this.httpServer;
    /**
    * The default/'root' router for the application
    * @type {Router}
    */
    this.root = new Router('/', this.expressApp);
    /**
    * The router which handles all APIs
    * @type {Router}
    */
    this.api = new Router('api', this.root);
    /**
    * Hook for interrupting requests
    * @type {Hook}
    */
    this.requestHook = new Hook({ type: Hook.Types.Series, mutable: true });

    this.expressApp.set('view engine', 'hbs');
    /**
    * Need to wait for other modules to load before we properly initialise &
    * start listening to incoming connections
    */
    this.setReady();
    this.app.onReady().then(() => this.init());
  }
  /**
  *
  */
  init() {
    // Initialise the root router
    this.root.init();
    // Initialise the API router
    this.api.enableAPIMap();
    this.api.init();
    // add not-found handlers
    this.api.expressRouter.use((req, res, next) => {
      const msg = this.t('error.routenotfound', { method: req.method, url: req.originalUrl });
      const opts = { statusCode: Responder.StatusCodes.Error.Missing };
      new Responder(res).error(msg, opts);
    });
    this.root.expressRouter.use((req, res, next) => {
      res.status(Responder.StatusCodes.Error.Missing).end();
    });
    // add generic error handling
    this.expressApp.use((error, req, res, next) => {
      this.log('error', this.getConfig('logStackOnError') ? error.stack : error.toString());
      new Responder(res).error(error);
    });
    this.listen(this.getConfig('port'), () => {
      this.log('info', this.app.lang.t('info.applistening', { port: this.httpServer.address().port }));
      this.log('info', this.app.lang.t('info.appavailable', { url:  this.url }));
    });
  }
  /**
  * Middleware function to allow serving of static files
  * @type {Function}
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
  * @param {number} port The port to listen on.
  * @param {function} func Callback function to be called on connection.
  */
  listen(port, func) {
    this.httpServer = this.expressApp.listen(port, func);
    return this.httpServer;
  };
  /**
  * Stops the Express server
  * @param {function} func Callback function to be called on close.
  */
  close(func) {
    if(!httpServer) {
      this.log('warn', this.app.lang.t('error.noserver'));
      return func();
    }
    const port = this.httpServer.address().port;
    this.httpServer.close(() => {
      this.httpServer = undefined;
      this.log('info', this.app.lang.t('info.appstoplistening', { port }));
      func();
    });
  };
}

module.exports = ServerModule;
