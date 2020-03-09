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
      error = { message: error.message, ...error };
    } else {
      this.log('error', error);
    }
    res.sendError(error.statusCode || ServerUtils.StatusCodes.Error.Default, error);
  }
  /**
  * Handler for returning an API map
  * @param {Router} topRouter
  * @return {Function} Middleware function
  */
  static mapHandler(topRouter) {
    return (req, res) => {
      const map = flattenRouters(topRouter)
        .sort((a,b) => a.route.localeCompare(b.route))
        .reduce((m,r) => {
          const key = `${getRelativeRoute(topRouter, r)}endpoints`;
          const endpoints = getEndpoints(r);
          return endpoints.length ? { ...m, [key]: endpoints } : m;
        }, {});

      res.json(map);
    };
  }
}
/** @ignore */ function flattenRouters(r) {
  return r.childRouters.reduce((a,c) => {
    if(c.childRouters) a.push(c, ...flattenRouters(c));
    return a;
  }, []);
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
  let route = '';
  for(let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.route}_${route}`;
  return route;
}

module.exports = ServerUtils;
