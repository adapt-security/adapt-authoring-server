import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCHEMA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../schema')

/** @ignore */
const schemaCache = new Map()

/**
 * Loads and caches a JSON schema file by path.
 * @param {String} schemaPath Absolute path to the schema file
 * @return {Promise<Object>} Parsed schema object
 * @ignore
 */
async function loadSchema (schemaPath) {
  if (!schemaCache.has(schemaPath)) {
    schemaCache.set(schemaPath, JSON.parse(await readFile(schemaPath, 'utf8')))
  }
  return schemaCache.get(schemaPath)
}
/**
 * Validates a value against a JSON Schema subset.
 * Supports: type, required, properties, propertyNames.enum, additionalProperties.
 * @param {*} data Value to validate
 * @param {Object} schema JSON Schema object
 * @param {String} pointer JSON pointer for error messages
 * @return {Array<String>} Array of validation error messages
 * @ignore
 */
function validateSchema (data, schema, pointer = '') {
  const errors = []
  const loc = pointer || '/'

  if (schema.type) {
    const jsType = Array.isArray(data) ? 'array' : typeof data
    if (jsType !== schema.type) {
      errors.push(`${loc}: expected type '${schema.type}', got '${jsType}'`)
      return errors
    }
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!Object.hasOwn(data, key)) {
          errors.push(`${loc}: missing required property '${key}'`)
        }
      }
    }

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (Object.hasOwn(data, key)) {
          errors.push(...validateSchema(data[key], propSchema, `${pointer}/${key}`))
        }
      }
    }

    if (schema.propertyNames?.enum) {
      const allowed = schema.propertyNames.enum
      for (const key of Object.keys(data)) {
        if (!allowed.includes(key)) {
          errors.push(`${loc}: property name '${key}' is not allowed (must be one of: ${allowed.join(', ')})`)
        }
      }
    }

    if (schema.additionalProperties?.type) {
      const knownKeys = schema.properties ? Object.keys(schema.properties) : []
      for (const [key, value] of Object.entries(data)) {
        if (!knownKeys.includes(key)) {
          const jsType = Array.isArray(value) ? 'array' : typeof value
          if (jsType !== schema.additionalProperties.type) {
            errors.push(`${pointer}/${key}: expected type '${schema.additionalProperties.type}', got '${jsType}'`)
          }
        }
      }
    }
  }

  return errors
}

/**
 * Reads and processes a routes.json file from a module's root directory,
 * validating against the base schema and resolving handler strings against a target object.
 * @param {String} rootDir Path to the module root (where routes.json lives)
 * @param {Object} target The object to resolve handler strings against
 * @param {Object} [options] Optional configuration
 * @param {String} [options.schema] Schema name to validate against (defaults to 'routes')
 * @param {String} [options.schemaDir] Directory to load schemas from (defaults to server's schema dir)
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

  // Schema validation
  const schemaName = options.schema || 'routes'
  const schemaDir = options.schemaDir || SCHEMA_DIR
  const schemaPath = path.join(schemaDir, `${schemaName}.schema.json`)
  const topSchema = await loadSchema(schemaPath)
  const topErrors = validateSchema(config, topSchema)
  if (topErrors.length) {
    throw new Error(`Invalid routes.json at ${filePath}:\n${topErrors.join('\n')}`)
  }

  // Route item validation
  if (Array.isArray(config.routes)) {
    const itemSchema = await loadSchema(path.join(SCHEMA_DIR, 'routeitem.schema.json'))
    config.routes.forEach((routeDef, i) => {
      const itemErrors = validateSchema(routeDef, itemSchema, `/routes/${i}`)
      if (itemErrors.length) {
        throw new Error(`Invalid routes.json at ${filePath}:\n${itemErrors.join('\n')}`)
      }
    })
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
