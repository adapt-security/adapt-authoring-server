/**
 * This file exists to define the below types for documentation purposes.
 */
/**
 * Built-in HTTP server
 * @external http-Server
 * @see {@link https://nodejs.org/api/http.html#http_class_http_server}
 */
/**
 * Express.js top-level application
 * @external express~App
 * @see {@link https://expressjs.com/en/4x/api.html#app}
 */
/**
 * Express.js HTTP router
 * @external express~Router
 * @see {@link https://expressjs.com/en/4x/api.html#router}
 */
/**
 * Express.js HTTP request
 * @external express~Request
 * @see {@link https://expressjs.com/en/4x/api.html#req}
 */
/**
 * Express.js HTTP response
 * @external express~Response
 * @see {@link https://nodejs.org/api/http.html#http_class_http_serverresponse}
 */
/**
 * Defines how an individual API route should be handled
 * @typedef {Object} Route
 * @property {String} route The name of the api (this will be used as the API endpoint)
 * @property {Object} handlers Object mapping HTTP methods to request handler functions. Note: Any HTTP methods not specified in `handlers` will not be exposed.
 * @property {Array<Function>|Function} [handlers.post] POST handlers for the route
 * @property {Array<Function>|Function} [handlers.get] GET handlers for the route
 * @property {Array<Function>|Function} [handlers.put] PUT handlers for the route
 * @property {Array<Function>|Function} [handlers.delete] DELETE handlers for the route
 * @example
 * {
 *   route: '/:id?',
 *   handlers: {
 *     // can be an array of middleware/handlers
 *     post: [beforePost, handlePostRequest, afterPost],
 *     // or an individual function
 *     get: getRequest,
 *     put: putRequest,
 *     // or an in-line function
 *     delete: (req, res, next) => { next(); }
 *   }
 * }
 */