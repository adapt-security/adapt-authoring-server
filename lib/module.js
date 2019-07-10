const express = require('express');
const path = require('path');
const { Module, Responder, Utils } = require('adapt-authoring-core');
const Router = require('./router');
/**
* Adds an Express server to the authoring tool
* @extends {Module}
*/
class Server extends Module {
  /**
  * Returns the URL for the server from its config
  * @return {String} The formatted URL
  */
  get url() {
    const { aat_app_url, aat_server_host, aat_server_port } = this.app.env;
    return aat_app_url || `${aat_server_host}:${aat_server_port}`;
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
    expressApp.set('x-powered-by', false);
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

    this.listen(this.config.aat_server_port, () => {
      this.log('info', `listening on ${this.config.aat_server_port}`);
      this.log('info', `app available at ${this.url}`);
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
    // show a map of API andpoints
    this.api._router.get('/', (req, res, next) => {
      const root = this.url;
      const transformed = Object.entries(this.api.map)
        .sort((a,b) => a[1].localeCompare(b[1]))
        .reduce((m, [name, path]) => {
          return Object.assign(m, { [`${name}_url`]: `${root}${path}` });
        }, {});
      res.json(transformed);
    });
    this.api.init();
  }
}

module.exports = Server;
