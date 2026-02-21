/**
 * Generates a map for a given router
 * @param {Router} topRouter
 * @return {Object} The route map
 * @memberof server
 */
export function generateRouterMap (topRouter) {
  return topRouter.flattenRouters()
    .sort((a, b) => a.root.localeCompare(b.root))
    .reduce((m, r) => {
      const key = `${getRelativeRoute(topRouter, r)}endpoints`
      const endpoints = getEndpoints(r)
      return endpoints.length ? { ...m, [key]: endpoints } : m
    }, {})
}

/** @ignore */
function getEndpoints (r) {
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

/** @ignore */
function getRelativeRoute (relFrom, relTo) {
  if (relFrom === relTo) {
    return `${relFrom.route}_`
  }
  let route = ''
  for (let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.root}_${route}`
  return route
}
