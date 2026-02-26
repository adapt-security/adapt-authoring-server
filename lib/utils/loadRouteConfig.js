import path from 'node:path'
import { App, readJson } from 'adapt-authoring-core'

/**
 * Reads and processes a routes.json file from a module's root directory,
 * validating against the app's jsonschema module and resolving handler strings against a target object.
 * @param {String} rootDir Path to the module root (where routes.json lives)
 * @param {Object} target The object to resolve handler strings against
 * @param {Object} [options] Optional configuration
 * @param {String} [options.schema] Schema name to validate against (defaults to 'routes')
 * @param {Object} [options.handlerAliases] Map of handler string aliases to pre-resolved functions
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
  // Handler resolution
  const aliases = options.handlerAliases || {}
  if (Array.isArray(config.routes)) {
    config.routes = config.routes.map(routeDef => {
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
  return config
}
