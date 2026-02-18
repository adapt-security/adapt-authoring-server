import _ from 'lodash'
import { App } from 'adapt-authoring-core'
/**
 * Server-related utilities
 * @memberof server
 */
class ServerUtils {
  /**
   * Middleware for handling 404 errors on the API router
   * @param {external:ExpressRequest} req
   * @param {external:ExpressResponse} res
   * @param {Function} next
   */
  static apiNotFoundHandler (req, res, next) {
    next(App.instance.errors.ENDPOINT_NOT_FOUND.setData({ endpoint: req.originalUrl, method: req.method }))
  }

  /**
   * Middleware for handling 405 Method Not Allowed errors
   * Checks if the requested path exists with a different HTTP method
   * @param {Router} router The router to check routes against
   * @return {Function} Middleware function
   */
  static methodNotAllowedHandler (router) {
    const routePatterns = []
    const routeMap = ServerUtils.getAllRoutes(router)

    for (const [path, methods] of routeMap.entries()) {
      const pathPattern = path
        .replace(/\/:([^/?]+)\?/g, '(?:/([^/]+))?')
        .replace(/:([^/]+)/g, '([^/]+)')
      const regex = new RegExp(`^${pathPattern}$`)
      routePatterns.push({ regex, methods })
    }

    return (req, res, next) => {
      const requestMethod = req.method.toUpperCase()

      for (const { regex, methods } of routePatterns) {
        if (regex.test(req.path)) {
          if (!methods.has(requestMethod)) {
            const allowedMethods = Array.from(methods).sort().join(', ')
            return next(App.instance.errors.METHOD_NOT_ALLOWED.setData({
              endpoint: req.originalUrl,
              method: req.method,
              allowedMethods
            }))
          }
          return next()
        }
      }

      next()
    }
  }

  /**
   * Generic error handling middleware for the API router
   * @param {Error} error
   * @param {external:ExpressRequest} req
   * @param {external:ExpressResponse} res
   * @param {Function} next
   */
  static genericErrorHandler (error, req, res, next) {
    this.log('error', App.instance.lang.translate(undefined, error), this.getConfig('verboseErrorLogging') && error.stack ? error.stack : '')
    res.sendError(error)
  }

  /**
   * Middleware for handling 404 errors on the root router
   * @param {external:ExpressRequest} req
   * @param {external:ExpressResponse} res
   */
  static rootNotFoundHandler (req, res) {
    res.status(App.instance.errors.NOT_FOUND.statusCode).end()
  }

  /**
   * Handler for returning an API map
   * @param {Router} topRouter
   * @return {Function} Middleware function
   */
  static mapHandler (topRouter) {
    return (req, res) => res.json(topRouter.map)
  }

  /**
   * Collects all registered routes with their methods across the router hierarchy
   * @param {Router} router The router to traverse
   * @return {Map<string, Set<string>>} Map of route paths to sets of allowed methods
   */
  static getAllRoutes (router) {
    const routeMap = new Map()

    router.flattenRouters().forEach(r => {
      r.routes.forEach(route => {
        const fullPath = `${r.path !== '/' ? r.path : ''}${route.route}`

        if (!routeMap.has(fullPath)) {
          routeMap.set(fullPath, new Set())
        }

        Object.keys(route.handlers).forEach(method => {
          routeMap.get(fullPath).add(method.toUpperCase())
        })
      })
    })

    return routeMap
  }

  /**
   * Generates a map for a given router
   * @param {Router} topRouter
   * @return {Object} The route map
   */
  static generateRouterMap (topRouter) {
    return topRouter.flattenRouters()
      .sort((a, b) => a.root.localeCompare(b.root))
      .reduce((m, r) => {
        const key = `${getRelativeRoute(topRouter, r)}endpoints`
        const endpoints = getEndpoints(r)
        return endpoints.length ? { ...m, [key]: endpoints } : m
      }, {})
  }

  /**
   * Adds extra properties to the request object to allow for easy translations
   * @param {Function} next
   */
  static addErrorHandler (req, res, next) {
    res.sendError = error => {
      if (error.constructor.name !== 'AdaptError') {
        const e = App.instance.errors[error.code]
        if (e) {
          if (error.statusCode) e.statusCode = error.statusCode
          e.error = error.message
          error = e
        } else {
          error = App.instance.errors.SERVER_ERROR
        }
      }
      res
        .status(error.statusCode)
        .json({ code: error.code, message: req.translate?.(error) ?? error.message, data: error.data })
    }
    next()
  }

  /**
   * Adds logs for debugging each request time
   * @param {external:ExpressRequest} req
   * @param {external:ExpressResponse} res
   * @param {Function} next
   */
  static async debugRequestTime (req, res, next) {
    const server = await App.instance.waitForModule('server')
    const start = new Date()
    res.on('finish', () => server.log('verbose', 'REQUEST_DURATION', req.method, req.originalUrl, new Date() - start, req.auth?.user?._id?.toString()))
    next()
  }

  /**
   * Adds extra properties to the request object to allow for easy existence checking of common request objects
   * @param {external:ExpressRequest} req
   * @param {external:ExpressResponse} res
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
  static addExistenceProps (req, res, next) {
    if (req.method === 'GET') {
      req.body = {}
    }
    const storeVal = (key, exists) => {
      req[`has${_.capitalize(key)}`] = exists
    }
    ['body', 'params', 'query'].forEach(attr => {
      if (!req[attr]) {
        return storeVal(attr, true)
      }
      const entries = Object.entries(req[attr])
      let deleted = 0
      if (entries.length === 0) {
        return storeVal(attr, false)
      }
      entries.forEach(([key, val]) => {
        if (val === undefined || val === null) {
          delete req[attr][key]
          deleted++
        }
      })
      storeVal(attr, deleted < entries.length)
    })
    next()
  }

  /**
   * Handles restriction of routes marked as internal
   * @param {external:ExpressRequest} req
   * @param {external:ExpressResponse} res
   * @param {Function} next
   */
  static async handleInternalRoutes (req, res, next) {
    const server = await App.instance.waitForModule('server')
    const isInternalIp = server.getConfig('host') === req.ip || req.ip === '127.0.0.1' || req.ip === '::1'
    if (req.routeConfig.internal && !isInternalIp) {
      return next(App.instance.errors.UNAUTHORISED.setData({ url: req.originalUrl, method: req.method }))
    }
    next()
  }

  /**
   * Caches the route config on the incoming request
   * @param {Route} routeConfig
   * @return {Function}
   */
  static cacheRouteConfig (routeConfig) {
    return (req, res, next) => {
      req.routeConfig = routeConfig
      next()
    }
  }
}
/** @ignore */ function getEndpoints (r) {
  return r.routes.map(route => {
    return {
      url: `${r.url}${route.route}`,
      accepted_methods: Object.keys(route.handlers).reduce((memo, method) => {
        return {
          ...memo,
          [method]: route?.meta?.[method] ?? {}
        }
      }, {})
    }
  })
}
/** @ignore */ function getRelativeRoute (relFrom, relTo) {
  if (relFrom === relTo) {
    return `${relFrom.route}_`
  }
  let route = ''
  for (let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.root}_${route}`
  return route
}

export default ServerUtils
