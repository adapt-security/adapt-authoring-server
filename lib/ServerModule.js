import express from 'express';
import { AbstractModule, Hook } from 'adapt-authoring-core';
import Router from './Router.js';
import ServerUtils from './ServerUtils.js';
/**
 * Adds an Express server to the authoring tool
 * @extends {AbstractModule}
 */
class ServerModule extends AbstractModule {
  /** @override */
  async init() {
    /**
     * The main Express Application
     * @type {external:express~App}
     */
    this.expressApp = express();
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
     * Whether the HTTP server is listening for requests
     * @type {Boolean}
     */
    this.isListening = false;
    /**
     * Hook invoked when the HTTP server is listening
     * @type {Hook}
     */
    this.listeningHook = new Hook();
    /**
     * Hook for interrupting requests
     * @type {Hook}
     */
    this.requestHook = new Hook({ mutable: true });
    /**
     * Reference to the HTTP server used by Express
     * @type {external:http~Server}
     */
    this.httpServer = undefined;

    this.expressApp.set('trust proxy', this.getConfig('trustProxy'));
    this.expressApp.set('view engine', 'hbs');
    /**
     * Need to wait for other modules to load before we properly initialise &
     * start listening for incoming connections
     */
    this.app.onReady().then(this.start.bind(this)).catch(e => this.log('error', e));
  }
  /**
   * Starts the HTTP server
   */
  async start() {
    // Initialise the root router
    this.root.init();
    // Initialise the API router
    this.api.expressRouter.get('/', ServerUtils.mapHandler(this.api).bind(this));
    this.api.addMiddleware(
      ServerUtils.debugRequestTime, 
    );
    this.api.init();
    // add not-found handlers
    this.api.expressRouter.use(ServerUtils.apiNotFoundHandler.bind(this));
    this.root.expressRouter.use(ServerUtils.rootNotFoundHandler.bind(this));
    // add generic error handling
    this.expressApp.use(ServerUtils.genericErrorHandler.bind(this));

    await this.listen();
    this.log('info', `listening on ${this.port}`);
  }
  /**
   * Server hostname
   * @type {String}
   */
  get host() {
    return this.getConfig('host');
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
   * @return {Promise} Resolves with the server instance
   */
  listen() {
    return new Promise((resolve, reject) => {
      this.httpServer = this.expressApp.listen(this.port, this.host, () => {
        this.console.log(e);
        this.isListening = true;
        this.listeningHook.invoke();
        resolve(this.httpServer);
      }).once('error', e => reject(this.app.errors.SERVER_START.setData({ error: e })));
    });
  }
  /**
   * Stops the Express server
   * @return {Promise}
   */
  close() {
    return new Promise((resolve, reject) => {
      if(!this.httpServer) {
        this.log('warn', `cannot stop server, it wasn't running!`);
        return resolve();
      }
      if(!this.isListening) return this.listeningHook.tap(this.close.bind(this));
      else this.listeningHook.untap(this.close);

      this.httpServer.close(() => {
        this.httpServer = undefined;
        this.log('info', `no longer listening on ${this.port}`);
        return resolve();
      });
    });
  }
}

export default ServerModule;