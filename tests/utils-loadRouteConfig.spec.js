import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Schemas } from 'adapt-schemas'
import { App } from 'adapt-authoring-core'
import { loadRouteConfig } from '../lib/utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_DIR = path.resolve(__dirname, '../schema')
const dataDir = path.join(__dirname, 'data')
const tmpDir = path.join(__dirname, 'tmp')

/** Shared schema registry backing the jsonschema module mock */
let schemas

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

    // Build shared schema registry with the server's base schemas, mirroring how
    // adapt-authoring-jsonschema auto-discovers schema/ files from all dependencies at startup
    schemas = new Schemas()
    await schemas.init()
    await schemas.registerSchema(path.join(SCHEMA_DIR, 'routes.schema.json'))
    await schemas.registerSchema(path.join(SCHEMA_DIR, 'routeitem.schema.json'))

    // Mock App.instance.waitForModule so loadRouteConfig can resolve 'jsonschema'
    // without a running app instance
    App.instance.waitForModule = async (modName) => {
      if (modName === 'jsonschema') {
        return { getSchema: (name) => schemas.getSchema(name) }
      }
      throw new Error(`Module '${modName}' not available in test environment`)
    }

    // App.init() runs in the background and fails in test context (no real modules),
    // setting process.exitCode = 1. Wait for it to settle then reset exitCode.
    await App.instance.onReady().catch(() => {})
    process.exitCode = 0
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

  it('should use handlerAliases when provided', async () => {
    const aliasHandler = () => 'alias'
    const target = { listItems: () => {} }
    const config = await loadRouteConfig(dataDir, target, { handlerAliases: { insertRecursive: aliasHandler } })

    assert.equal(config.routes[0].handlers.post, aliasHandler)
  })

  it('should throw a clear error for unresolvable handler strings', async () => {
    const target = { listItems: () => {} } // missing insertRecursive
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

  it('should preserve consumer-specific top-level fields after validation', async () => {
    // Consumer schema mirrors how apiroutes/authroutes extend the base via $merge
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
    await schemas.registerSchema(schemaFile)
    try {
      const dir = path.join(tmpDir, 'consumer-fields')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), { root: 'content', schemaName: 'content', routes: [] })
      const config = await loadRouteConfig(dir, {}, { schema: 'withschema' })
      assert.equal(config.schemaName, 'content')
    } finally {
      schemas.deregisterSchema('withschema')
    }
  })

  it('should validate route items via consumer schema using $merge', async () => {
    // Note: real consumer schemas use items.$ref: 'routeitem' which is resolved by the
    // jsonschema module at startup. In tests we inline the items constraint because AJV
    // throws anchor conflicts when $ref targets an already-registered schema.
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
    await schemas.registerSchema(schemaFile)
    try {
      const dir = path.join(tmpDir, 'missing-route-field')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), {
        root: 'test',
        routes: [{ handlers: { get: 'myHandler' } }]
      })
      await assert.rejects(
        () => loadRouteConfig(dir, {}, { schema: 'strict-routes' }),
        /Invalid routes\.json.*must have required property 'route'/s
      )
    } finally {
      schemas.deregisterSchema('strict-routes')
    }
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
    await schemas.registerSchema(schemaFile)
    try {
      const dir = path.join(tmpDir, 'missing-schemaname')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), { root: 'test', routes: [] })
      await assert.rejects(
        () => loadRouteConfig(dir, {}, { schema: 'custom' }),
        /Invalid routes\.json.*must have required property 'schemaName'/s
      )
    } finally {
      schemas.deregisterSchema('custom')
    }
  })

  describe('permissions field in route items', () => {
    // Note: real consumer schemas use items.$ref: 'routeitem' which includes the permissions
    // property. In tests we inline the constraint because AJV throws anchor conflicts when
    // $ref targets an already-registered schema. The permissions definition here mirrors
    // routeitem.schema.json to ensure the same validation behaviour.
    const permSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $anchor: 'perm-routes',
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
                  handlers: { type: 'object' },
                  permissions: {
                    type: 'object',
                    propertyNames: { enum: ['get', 'post', 'put', 'patch', 'delete'] },
                    additionalProperties: {
                      oneOf: [
                        { type: 'array', items: { type: 'string' } },
                        { type: 'null' }
                      ]
                    }
                  }
                },
                required: ['route', 'handlers']
              }
            }
          }
        }
      }
    }

    before(async () => {
      await schemas.registerSchema(await writeJson(path.join(tmpDir, 'perm-routes.schema.json'), permSchema))
    })

    after(() => schemas.deregisterSchema('perm-routes'))

    it('should accept null permission values (unsecured routes)', async () => {
      const dir = path.join(tmpDir, 'perms-null')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), {
        root: 'test',
        routes: [{ route: '/test', handlers: { post: 'myHandler' }, permissions: { post: null } }]
      })
      const config = await loadRouteConfig(dir, { myHandler: () => {} }, { schema: 'perm-routes' })
      assert.equal(config.routes[0].permissions.post, null)
    })

    it('should reject invalid HTTP method keys in permissions', async () => {
      const dir = path.join(tmpDir, 'perms-invalid-key')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), {
        root: 'test',
        routes: [{ route: '/test', handlers: { post: 'myHandler' }, permissions: { invalidMethod: null } }]
      })
      await assert.rejects(
        () => loadRouteConfig(dir, { myHandler: () => {} }, { schema: 'perm-routes' }),
        /Invalid routes\.json.*property name must be valid/s
      )
    })
  })

  describe('defaults option', () => {
    it('should prepend default routes from template when defaults path is provided', async () => {
      const dir = path.join(tmpDir, 'with-defaults')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), {
        root: 'test',
        routes: [{ route: '/custom', handlers: { get: 'listItems' } }]
      })
      const defaultsPath = path.join(tmpDir, 'defaults.json')
      await writeJson(defaultsPath, {
        routes: [{ route: '/', handlers: { post: 'insertRecursive' } }]
      })
      const target = {
        insertRecursive: () => {},
        listItems: () => {}
      }
      const config = await loadRouteConfig(dir, target, { defaults: defaultsPath })
      assert.equal(config.routes.length, 2)
      assert.equal(config.routes[0].route, '/')
      assert.equal(config.routes[1].route, '/custom')
    })

    it('should resolve handler strings in default routes using handlerAliases', async () => {
      const dir = path.join(tmpDir, 'defaults-aliases')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), { root: 'test', routes: [] })
      const defaultsPath = path.join(tmpDir, 'defaults-aliases.json')
      await writeJson(defaultsPath, {
        routes: [{ route: '/', handlers: { post: 'myAlias' } }]
      })
      let called = false
      const aliasHandler = () => { called = true }
      const config = await loadRouteConfig(dir, {}, {
        defaults: defaultsPath,
        handlerAliases: { myAlias: aliasHandler }
      })
      assert.equal(typeof config.routes[0].handlers.post, 'function')
      config.routes[0].handlers.post()
      assert.ok(called)
    })

    it('should resolve handler strings in default routes against target methods', async () => {
      const dir = path.join(tmpDir, 'defaults-target')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), { root: 'test', routes: [] })
      const defaultsPath = path.join(tmpDir, 'defaults-target.json')
      await writeJson(defaultsPath, {
        routes: [{ route: '/', handlers: { get: 'myMethod' } }]
      })
      let called = false
      const target = { myMethod () { called = true } }
      const config = await loadRouteConfig(dir, target, { defaults: defaultsPath })
      config.routes[0].handlers.get()
      assert.ok(called)
    })

    it('should not load defaults when routes.json does not exist', async () => {
      const defaultsPath = path.join(tmpDir, 'unused-defaults.json')
      await writeJson(defaultsPath, {
        routes: [{ route: '/', handlers: { get: 'foo' } }]
      })
      const result = await loadRouteConfig(path.join(__dirname, 'nonexistent'), {}, { defaults: defaultsPath })
      assert.equal(result, null)
    })

    it('should preserve non-handler fields on default route definitions', async () => {
      const dir = path.join(tmpDir, 'defaults-fields')
      await mkdir(dir, { recursive: true })
      await writeJson(path.join(dir, 'routes.json'), { root: 'test', routes: [] })
      const defaultsPath = path.join(tmpDir, 'defaults-fields.json')
      await writeJson(defaultsPath, {
        routes: [{
          route: '/',
          handlers: { post: 'myHandler' },
          permissions: { post: null },
          meta: { post: { summary: 'Test' } }
        }]
      })
      const config = await loadRouteConfig(dir, { myHandler: () => {} }, { defaults: defaultsPath })
      assert.equal(config.routes[0].permissions.post, null)
      assert.equal(config.routes[0].meta.post.summary, 'Test')
    })
  })
})
