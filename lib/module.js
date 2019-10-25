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
    // the main Express Application
    const expressApp = express();
    /**
    * The default/'root' router for the application
    * @type {Router}
    */
    this.root = new Router('/', expressApp);
    /**
    * The router which handles all APIs
    * @type {Router}
    */
    this.api = new Router('api', this.root);
    /**
    * Hook for interrupting requests
    * @type {Hook}
    */
    this.requestHook = new Hook({ type: Hook.Types.Series });
    /**
    * Middleware function to allow serving of static files
    * @type {Function}
    * @see https://expressjs.com/en/4x/api.html#express.static
    * @param {String} root The root directory from which to serve static assets
    * @param {Object} options Options to pass to the function
    * @return {Function}
    */
    this.static = express.static;
    /**
    * Start the Express server (shortcut to the Express function of the same name).
    * @type {Function}
    * @see https://expressjs.com/en/4x/api.html#app.listen
    * @param {number} port The port to listen on.
    * @param {function} func Callback function to be called on connection.
    */
    this.listen = expressApp.listen.bind(expressApp);

    expressApp.set('view engine', 'hbs');
  }
  /**
  * Starts the server
  * @param {App} app App instance
  * @param {Function} resolve Function to call on fulfilment
  * @param {Function} reject Function to call on rejection
  */
  boot(app, resolve, reject) {
    // root last to allow for sub-router error handling
    this.initApiRouter();
    this.initRootRouter();

    const port = this.getConfig('port');

    this.listen(port, () => {
      this.log('info', this.app.lang.t('info.applistening', { port }));
      this.log('info', this.app.lang.t('info.appavailable', { url:  this.url }));
      resolve();
    });
  }
  /**
  * Initialises the root router
  */
  initRootRouter() {
    this.root.init();
  }
  /**
  * Initialises the API router
  */
  initApiRouter() {
    this.api.enableAPIMap();
    this.api.init();
  }
}

module.exports = ServerModule;
