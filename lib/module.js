const express = require('express');
const path = require('path');
const { Module, Responder, Utils } = require('adapt-authoring-core');
const Router = require('./router');
/**
* Adds an Express server to the authoring tool
* @extends {Module}
*/
class Server extends Module {
  get url() {
    const { aat_app_url, aat_server_host, aat_server_port } = this.app.env;
    return aat_app_url || `${aat_server_host}:${aat_server_port}`;
  }
  /**
  * @constructor
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
  * Creates and adds a sub-router to the main server.
  * @param {string} route The route to listen on
  * @param {boolean} isApi whether the router should be treated as an API
  * @return {express~Router} The new router instance
  */
  createRouter(route, isApi=false) {
    const parentRouter = isApi ? this.api : this.root;
    const router = new Router(route);

    parentRouter.addRouter(router);

    this.log('debug', `added ${isApi ? 'API ' : ''}router at ${router.path}`);

    return router;
  }
  /**
  * Starts the server
  * @param {Module} app App instance
  * @param {Function} resolve Function to call on fulfilment
  * @param {Function} reject Function to call on rejection
  */
  boot(app, resolve, reject) {
    this.root.init();
    this.api.init();
    // show a map of API andpoints
    this.api._router.use('/', (req, res, next) => {
      res.json(Object.entries(this.api.map).reduce((m, [name,path]) => {
        return Object.assign(m, { [`${name}_url`]: `${this.url}${path}` });
      }, {}));
    });
    this.listen(this.config.aat_server_port, () => {
      this.log('info', `listening on ${this.config.aat_server_port}`);
      this.log('info', `app available at ${this.url}`);
      resolve();
    });
  }
}

module.exports = Server;
