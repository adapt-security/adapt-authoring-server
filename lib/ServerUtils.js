import { App } from 'adapt-authoring-core'
import { getAllRoutes } from './utils/getAllRoutes.js'

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
    const routeMap = getAllRoutes(router)

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
}

export default ServerUtils
