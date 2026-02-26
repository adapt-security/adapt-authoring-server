import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRouteConfig } from '../lib/utils/loadRouteConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const tmpDir = path.join(__dirname, 'tmp')

/**
 * Writes a JSON file and returns its path.
 * @param {String} filePath Absolute path to write the JSON file
 * @param {Object} data Data to serialize as JSON
 * @return {Promise<String>} The file path
 * @ignore
 */
async function writeJson (filePath, data) {
  await writeFile(filePath, JSON.stringify(data))
  return filePath
}

describe('loadRouteConfig()', () => {
  before(async () => {
    await mkdir(tmpDir, { recursive: true })
  })

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('should return null when routes.json does not exist', async () => {
    const result = await loadRouteConfig(path.join(__dirname, 'nonexistent'), {})
    assert.equal(result, null)
  })

  it('should read and return config from routes.json', async () => {
    const target = {
      insertRecursive: () => {},
      listItems: () => {}
    }
    const config = await loadRouteConfig(dataDir, target)

    assert.ok(config !== null)
    assert.equal(config.root, 'content')
    assert.ok(Array.isArray(config.routes))
    assert.equal(config.routes.length, 2)
  })

  it('should resolve handler strings to bound functions', async () => {
    let called = false
    const target = {
      insertRecursive () { called = true },
      listItems: () => {}
    }
    const config = await loadRouteConfig(dataDir, target)
    const handler = config.routes[0].handlers.post

    assert.equal(typeof handler, 'function')
    handler()
    assert.ok(called)
  })

  it('should preserve non-handler fields on route definitions', async () => {
    const target = {
      insertRecursive: () => {},
      listItems: () => {}
    }
    const config = await loadRouteConfig(dataDir, target)
    const route = config.routes[0]

    assert.equal(route.route, '/insertrecursive')
    assert.equal(route.internal, false)
    assert.ok(route.meta)
  })

  it('should preserve consumer-specific top-level fields after validation', async () => {
    const dir = path.join(tmpDir, 'consumer-fields')
    await mkdir(dir, { recursive: true })
    const schemaFile = await writeJson(path.join(tmpDir, 'withschema.schema.json'), {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $anchor: 'withschema',
      $merge: {
        source: { $ref: 'routes' },
        with: {
          properties: { schemaName: { type: 'string' } },
          required: ['schemaName']
        }
      }
    })
    await writeJson(path.join(dir, 'routes.json'), {
      root: 'content',
      schemaName: 'content',
      routes: []
    })
    const target = {}
    const config = await loadRouteConfig(dir, target, { schema: 'withschema', schemaFile })
    assert.equal(config.schemaName, 'content')
  })

  it('should use handlerAliases when provided', async () => {
    const aliasHandler = () => 'alias'
    const target = {
      listItems: () => {}
    }
    const aliases = { insertRecursive: aliasHandler }
    const config = await loadRouteConfig(dataDir, target, { handlerAliases: aliases })

    assert.equal(config.routes[0].handlers.post, aliasHandler)
  })

  it('should throw a clear error for unresolvable handler strings', async () => {
    const target = {
      listItems: () => {}
      // intentionally missing insertRecursive
    }
    await assert.rejects(
      () => loadRouteConfig(dataDir, target),
      /Cannot resolve handler 'insertRecursive'/
    )
  })

  it('should throw when routes.json fails schema validation (missing required root)', async () => {
    const dir = path.join(tmpDir, 'no-root')
    await mkdir(dir, { recursive: true })
    await writeJson(path.join(dir, 'routes.json'), { routes: [] })
    await assert.rejects(
      () => loadRouteConfig(dir, {}),
      /Invalid routes\.json.*must have required property 'root'/s
    )
  })

  it('should throw when routes.json fails schema validation (wrong type for root)', async () => {
    const dir = path.join(tmpDir, 'wrong-root-type')
    await mkdir(dir, { recursive: true })
    await writeJson(path.join(dir, 'routes.json'), { root: 42, routes: [] })
    await assert.rejects(
      () => loadRouteConfig(dir, {}),
      /Invalid routes\.json.*must be string/s
    )
  })

  it('should validate route items via consumer schema using $merge', async () => {
    // Consumer schema extends routes and adds items constraint
    const schemaFile = await writeJson(path.join(tmpDir, 'strict-routes.schema.json'), {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $anchor: 'strict-routes',
      $merge: {
        source: { $ref: 'routes' },
        with: {
          properties: {
            routes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  route: { type: 'string' },
                  handlers: { type: 'object' }
                },
                required: ['route', 'handlers']
              }
            }
          }
        }
      }
    })

    // Missing 'route' field in a route item
    const dir = path.join(tmpDir, 'missing-route-field')
    await mkdir(dir, { recursive: true })
    await writeJson(path.join(dir, 'routes.json'), {
      root: 'test',
      routes: [{ handlers: { get: 'myHandler' } }]
    })
    await assert.rejects(
      () => loadRouteConfig(dir, {}, { schema: 'strict-routes', schemaFile }),
      /Invalid routes\.json.*must have required property 'route'/s
    )
  })

  it('should use a consumer-provided schema for top-level validation', async () => {
    const schemaFile = await writeJson(path.join(tmpDir, 'custom.schema.json'), {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $anchor: 'custom',
      $merge: {
        source: { $ref: 'routes' },
        with: {
          properties: { schemaName: { type: 'string' } },
          required: ['schemaName']
        }
      }
    })
    const dir = path.join(tmpDir, 'missing-schemaname')
    await mkdir(dir, { recursive: true })
    await writeJson(path.join(dir, 'routes.json'), { root: 'test', routes: [] })
    await assert.rejects(
      () => loadRouteConfig(dir, {}, { schema: 'custom', schemaFile }),
      /Invalid routes\.json.*must have required property 'schemaName'/s
    )
  })
})
