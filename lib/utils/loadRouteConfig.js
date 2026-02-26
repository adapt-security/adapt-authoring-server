import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Schemas, SchemaError } from 'adapt-schemas'

const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../schema')

/**
 * Builds a schema registry containing the server base schemas plus any extra schema file.
 * @param {String} [extraSchemaFile] Absolute path to an additional schema file to register
 * @return {Promise<Schemas>}
 * @ignore
 */
async function buildSchemas (extraSchemaFile) {
  const schemas = new Schemas()
  await schemas.init()
  await schemas.registerSchema(path.join(SCHEMA_DIR, 'routes.schema.json'))
  await schemas.registerSchema(path.join(SCHEMA_DIR, 'routeitem.schema.json'))
  if (extraSchemaFile) {
    await schemas.registerSchema(extraSchemaFile)
  }
  return schemas
}

/**
 * Reads and processes a routes.json file from a module's root directory,
 * validating against the base schema and resolving handler strings against a target object.
 * @param {String} rootDir Path to the module root (where routes.json lives)
 * @param {Object} target The object to resolve handler strings against
 * @param {Object} [options] Optional configuration
 * @param {String} [options.schema] Schema name to validate against (defaults to 'routes')
 * @param {String} [options.schemaFile] Absolute path to a consumer schema file to register before validating
 * @param {Object} [options.handlerAliases] Map of handler string aliases to pre-resolved functions
 * @return {Promise<Object|null>} Parsed config with resolved handlers, or null if no routes.json
 * @memberof server
 */
export async function loadRouteConfig (rootDir, target, options = {}) {
  const filePath = path.join(rootDir, 'routes.json')
  let raw
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  const config = JSON.parse(raw)

  // Schema validation using adapt-schemas (supports $merge/$ref composition)
  const schemaName = options.schema || 'routes'
  const schemas = await buildSchemas(options.schemaFile)
  try {
    // validate() internally clones the data; we use the original config to preserve extra fields
    await schemas.validate(schemaName, config)
  } catch (e) {
    if (e instanceof SchemaError && e.code === 'VALIDATION_FAILED') {
      throw new Error(`Invalid routes.json at ${filePath}: ${e.data.errors}`)
    }
    throw e
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
