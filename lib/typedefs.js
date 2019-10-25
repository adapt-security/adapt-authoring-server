/**
* This file exists to define the below types for documentation purposes.
*/
/**
* Defines how an individual API route should be handled
* @typedef {Object} Route
* @property {String} route The name of the api (this will be used as the API endpoint)
* @property {Object|Array} handlers Object defining Express request handler functions. If an array is specified, the default handler will be used. Any HTTP methods not specified in `handlers` will not be exposed.
* @property {Array<Function>|Function} [handlers.post] POST handlers for the route
* @property {Array<Function>|Function} [handlers.get] GET handlers for the route
* @property {Array<Function>|Function} [handlers.put] PUT handlers for the route
* @property {Array<Function>|Function} [handlers.delete] DELETE handlers for the route
* @example
* {
*   route: '/:id?',
*   handlers: {
*     post: [beforePost, handlePostRequest, afterPost],
*     get: getRequest,
*     put: putRequest,
*     delete: (req, res, next) => { next(); }
*   }
* }
*/
