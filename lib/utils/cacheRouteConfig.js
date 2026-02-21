/**
 * Caches the route config on the incoming request
 * @param {Route} routeConfig
 * @return {Function}
 * @memberof server
 */
export function cacheRouteConfig (routeConfig) {
  return (req, res, next) => {
    req.routeConfig = routeConfig
    next()
  }
}
