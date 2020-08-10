const _ = require('lodash');
/**
* Server-related utilities
*/
class ServerUtils {
  /**
  * HTTP status codes for common responses
  * @type {Object} StatusCodes
  * @property {Object} Success Success status codes
  * @property {Number} Success.post 201 (Created)
  * @property {Number} Success.get 200 (OK)
  * @property {Number} Success.put 200 (OK)
  * @property {Number} Success.patch 200 (OK)
  * @property {Number} Success.delete 204 (No Content)
  * @property {Object} Error Error status codes
  * @property {Number} Error.User 400 (Bad Request)
  * @property {Number} Error.Authenticate 401 (Unauthorized)
  * @property {Number} Error.Authorise 403 (Forbidden)
  * @property {Number} Error.Missing 404 (Not Found)
  */
  static get StatusCodes() {
    return {
      Success: {
        Default: 200,
        post: 201,
        get: 200,
        put: 200,
        patch: 200,
        delete: 204
      },
      Error: {
        Default: 500,
        User: 400,
        Missing: 404,
        Authenticate: 401,
        Authorise: 403
      }
    };
  }
  /**
  * Middleware for handling 404 errors on the root router
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  */
  static rootNotFoundHandler(req, res) {
    res.status(ServerUtils.StatusCodes.Error.Missing).end();
  }
  /**
  * Middleware for handling 404 errors on the API router
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  */
  static apiNotFoundHandler(req, res) {
    const message = this.t('error.routenotfound', { method: req.method, url: req.originalUrl });
    res.sendError(ServerUtils.StatusCodes.Error.Missing, message);
  }
  /**
  * Generic error handling middleware
  * @param {Error} error
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  */
  static genericErrorHandler(error, req, res, next) {
    if(error instanceof Error) {
      this.log('error', this.getConfig('logStackOnError') ? error.stack : error.toString());
    } else {
      this.log('error', error);
    }
    const status = error.statusCode || ServerUtils.StatusCodes.Error.Default;
    res.sendError ? res.sendError(status, error) : res.status(status).json(error);
  }
  /**
  * Handler for returning an API map
  * @param {Router} topRouter
  * @return {Function} Middleware function
  */
  static mapHandler(topRouter) {
    return (req, res) => {
      const map = topRouter.flattenRouters()
        .sort((a,b) => a.route.localeCompare(b.route))
        .reduce((m,r) => {
          const key = `${getRelativeRoute(topRouter, r)}endpoints`;
          const endpoints = getEndpoints(r);
          return endpoints.length ? { ...m, [key]: endpoints } : m;
        }, {});

      res.json(map);
    };
  }
  /**
  * Middleware wrapper for each request. Allows hook listeners to be invoked.
  * @example
  * "Adds the following to the ServerResponse object:"
  * - res.StatusCodes {Object} "Reference to ServerUtils.StatusCodes"
  * - res.sendError {Function(statusCode, error)} "error code/message (generic values used if omitted)"
  */
  static extendRequestData(req, res, next) {
    res.StatusCodes = ServerUtils.StatusCodes;
    res.sendError = ((statusCode = res.StatusCodes.Error.Default, error = this.t('error.genericrequesterror')) => {
      if(!_.isNumber(statusCode)) {
        return this.log('error', this.t('error.invalidstatuscode'));
      }
      res.status(statusCode);

      if(_.isString(error)) {
        return res.json({ message: error });
      }
      if(error instanceof Error) {
        return res.json({ message: error.message });
      }
      if(!error.hasOwnProperty('message')) {
        this.log('error', this.t('error.invaliderrorformat'));
        return res.json({ message: this.t('error.genericrequesterror') });
      }
      res.json(error);
    }).bind(this);
    next();
  }
  /**
  * Adds extra properties to the request object to allow for easy existence
  * checking of common request objects
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  * @example
  * "IMPORTANT NOTE: body data is completely ignored for GET requests, any code
  * requiring it should switch to use POST."
  *
  * let req = { 'params': { 'foo':'bar' }, 'query': {}, 'body': {} };
  * req.hasParams // true
  * req.hasQuery // false
  * req.hasBody // false
  */
  static addExistenceProps(req, res, next) {
    if(req.method === 'GET') {
      req.body = {};
    }
    const storeVal = (key, exists) => req[`has${_.capitalize(key)}`] = exists;
    ['body', 'params', 'query'].forEach(attr => {
      if(!req[attr]) {
        return storeVal(attr, true);
      }
      const entries = Object.entries(req[attr]);
      let deleted = 0;
      if(entries.length === 0) {
        return storeVal(attr, false);
      }
      entries.forEach(([key, val]) => {
        if(val === undefined || val === null) {
          delete req[attr][key];
          deleted++;
        }
      });
      storeVal(attr, deleted < entries.length);
    });
    next();
  }
}
/** @ignore */ function getEndpoints(r) {
  return r.routes.map(route => {
    return {
      url: `${r.url}${route.route}`,
      accepted_methods: Object.keys(route.handlers)
    };
  });
}
/** @ignore */ function getRelativeRoute(relFrom, relTo) {
  if(relFrom === relTo) {
    return `${relFrom.route}_`;
  }
  let route = '';
  for(let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.route}_${route}`;
  return route;
}

module.exports = ServerUtils;
