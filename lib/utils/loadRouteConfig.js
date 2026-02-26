import path from 'node:path'
import { App, readJson } from 'adapt-authoring-core'

/**
 * Resolves handler strings in route definitions against a target object and handler aliases.
 * @param {Array} routes Array of route definition objects
 * @param {Object} target The object to resolve handler strings against
 * @param {Object} aliases Map of handler string aliases to pre-resolved functions
 * @return {Array} Routes with handler strings replaced by bound functions
 */
function resolveHandlers (routes, target, aliases) {
  return routes.map(routeDef => {
    const resolved = { ...routeDef }
    if (routeDef.handlers) {
      resolved.handlers = Object.fromEntries(
        Object.entries(routeDef.handlers).map(([method, handlerStr]) => {
          if (Object.hasOwn(aliases, handlerStr)) {
            return [method, aliases[handlerStr]]
          }
          if (typeof target[handlerStr] !== 'function') {
            throw new Error(`Cannot resolve handler '${handlerStr}': no such method on target`)
          }
          return [method, target[handlerStr].bind(target)]
        })
      )
    }
    return resolved
  })
}

/**
 * Reads and processes a routes.json file from a module's root directory,
 * validating against the app's jsonschema module and resolving handler strings against a target object.
 * @param {String} rootDir Path to the module root (where routes.json lives)
 * @param {Object} target The object to resolve handler strings against
 * @param {Object} [options] Optional configuration
 * @param {String} [options.schema] Schema name to validate against (defaults to 'routes')
 * @param {Object} [options.handlerAliases] Map of handler string aliases to pre-resolved functions
 * @param {String} [options.defaults] Path to a default routes template JSON file. When provided and
 *   routes.json is found, the template's routes are resolved and prepended to config.routes.
 * @return {Promise<Object|null>} Parsed config with resolved handlers, or null if no routes.json
 * @memberof server
 */
export async function loadRouteConfig (rootDir, target, options = {}) {
  const filePath = path.join(rootDir, 'routes.json')
  let config
  try {
    config = await readJson(filePath)
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  const jsonschema = await App.instance.waitForModule('jsonschema')
  const schema = await jsonschema.getSchema(options.schema || 'routes')
  try {
    schema.validate(config)
  } catch (e) {
    throw new Error(`Invalid routes.json at ${filePath}: ${e.data?.errors || e.message}`)
  }
  const aliases = options.handlerAliases || {}

  // Resolve handler strings in routes.json routes
  const customRoutes = Array.isArray(config.routes)
    ? resolveHandlers(config.routes, target, aliases)
    : []

  // Prepend default routes from template if provided
  if (options.defaults) {
    const template = await readJson(options.defaults)
    const defaultRoutes = resolveHandlers(template.routes || [], target, aliases)
    // Apply override routes onto matching defaults
    const overrides = new Map(
      customRoutes.filter(r => r.override).map(r => [r.route, r])
    )
    const matched = new Set()
    const mergedDefaults = defaultRoutes.map(d => {
      const o = overrides.get(d.route)
      if (!o) return d
      matched.add(d.route)
      const { override, ...rest } = o
      return { ...d, ...rest, handlers: { ...d.handlers, ...rest.handlers } }
    })
    const remaining = customRoutes.filter(r => !r.override || !matched.has(r.route))
    config.routes = [...mergedDefaults, ...remaining]
  } else {
    config.routes = customRoutes
  }
  return config
}
