const { Responder } = require('adapt-authoring-core');

class ServerUtils {
  static rootNotFoundHandler(req, res, next) {
    res.status(Responder.StatusCodes.Error.Missing).end();
  }
  static apiNotFoundHandler(req, res, next) {
    const msg = this.t('error.routenotfound', { method: req.method, url: req.originalUrl });
    const opts = { statusCode: Responder.StatusCodes.Error.Missing };
    new Responder(res).error(msg, opts);
  }
  static genericErrorHandler(error, req, res, next) {
    this.log('error', this.getConfig('logStackOnError') ? error.stack : error.toString());
    new Responder(res).error(error);
  }
  static mapHandler(topRouter) {
    return (req, res) => {
      const map = flattenRouters(topRouter)
        .sort((a,b) => a.route.localeCompare(b.route))
        .reduce((m,r) => {
          return {
            ...m,
            [`${getRelativeRoute(topRouter, r)}endpoints`]: getEndpoints(r)
          }
        }, {});

      new Responder(res).success(map);
    }
  }
}

function flattenRouters(r) {
  return r.childRouters.reduce((a,c) => {
    if(c.childRouters) a.push(c, ...flattenRouters(c));
    return a;
  }, []);
}
function getEndpoints(r) {
  return r.routes.map(route => {
    return {
      url: `${r.url}${route.route}`,
      accepted_methods: Object.keys(route.handlers)
    };
  });
}
function getRelativeRoute(relFrom, relTo) {
  let route = '';
  for(let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.route}_${route}`;
  return route;
}

module.exports = ServerUtils;
