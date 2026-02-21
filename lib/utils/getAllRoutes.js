/**
 * Collects all registered routes with their methods across the router hierarchy
 * @param {Router} router The router to traverse
 * @return {Map<string, Set<string>>} Map of route paths to sets of allowed methods
 * @memberof server
 */
export function getAllRoutes (router) {
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
