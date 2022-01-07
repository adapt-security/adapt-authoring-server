import _ from 'lodash';
import { App } from 'adapt-authoring-core';
/**
 * Server-related utilities
 */
class ServerUtils {
  /**
   * Middleware for handling 404 errors on the API router
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  static apiNotFoundHandler(req, res, next) {
    return next(App.instance.errors.NOT_FOUND.setData(req));
  }
  /**
   * Generic error handling middleware for the API router
   * @param {Error} error
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  static genericErrorHandler(error, req, res, next) {
    this.log('error', this.getConfig('logStackOnError') && error.stack ? error.stack : error.toString());
    res
      .status(error.statusCode || App.instance.errors.SERVER_ERROR.statusCode)
      .json({ 
        code: error.code, 
        message: req.translate(error.code, error.date) 
      });
  }
  /**
   * Middleware for handling 404 errors on the root router
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   */
  static rootNotFoundHandler(req, res) {
    res.status(App.instance.errors.NOT_FOUND.statusCode).end();
  }
  /**
   * Handler for returning an API map
   * @param {Router} topRouter
   * @return {Function} Middleware function
   */
  static mapHandler(topRouter) {
    return (req, res) => res.json(topRouter.map);
  }
  /**
   * Generates a map for a given router
   * @param {Router} topRouter
   * @return {Object} The route map
   */
  static generateRouterMap(topRouter) {
    return topRouter.flattenRouters()
      .sort((a,b) => a.route.localeCompare(b.route))
      .reduce((m,r) => {
        const key = `${getRelativeRoute(topRouter, r)}endpoints`;
        const endpoints = getEndpoints(r);
        return endpoints.length ? { ...m, [key]: endpoints } : m;
      }, {});
  }
  static get defaultMiddleware() {
    return [
      this.addTranslationUtils,
      this.addExistenceProps
    ];
  }
  /**
   * Adds extra properties to the request object to allow for easy existence
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  static addTranslationUtils(req, res, next) {
    const lang = req.acceptsLanguages(App.instance.lang.supportedLanguages);
    req.translate = (key, data) => App.instance.lang.translate(lang, key, data);
  }
  /**
   * Adds extra properties to the request object to allow for easy existence checking of common request objects
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

export default ServerUtils;