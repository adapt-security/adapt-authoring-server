const { Responder } = require('adapt-authoring-core');
/**
* Server-related utilities
*/
class ServerUtils {
  /**
  * Middleware for handling 404 errors on the root router
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  */
  static rootNotFoundHandler(req, res, next) {
    res.status(Responder.StatusCodes.Error.Missing).end();
  }
  /**
  * Middleware for handling 404 errors on the API router
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  */
  static apiNotFoundHandler(req, res, next) {
    const msg = this.t('error.routenotfound', { method: req.method, url: req.originalUrl });
    const opts = { statusCode: Responder.StatusCodes.Error.Missing };
    new Responder(res).error(msg, opts);
  }
  /**
  * Generic error handling middleware
  * @param {Error} error
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  */
  static genericErrorHandler(error, req, res, next) {
    this.log('error', this.getConfig('logStackOnError') ? error.stack : error.toString());
    new Responder(res).error(error);
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

      new Responder(res).success(map);
    }
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
