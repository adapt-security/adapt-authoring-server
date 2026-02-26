/**
 * Registers routes on a router and configures their permissions with auth.
 * @param {Router} router The router to add routes to
 * @param {Array} routes Array of route definition objects
 * @param {Object} auth The auth module instance
 * @memberof server
 */
export function registerRoutes (router, routes, auth) {
  for (const r of routes) {
    router.addRoute(r)
    if (!r.permissions) continue
    for (const [method, perms] of Object.entries(r.permissions)) {
      if (perms) {
        auth.secureRoute(`${router.path}${r.route}`, method, perms)
      } else {
        auth.unsecureRoute(`${router.path}${r.route}`, method)
      }
    }
  }
}
