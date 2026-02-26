import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { writeFile, unlink, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRouteConfig } from '../lib/utils/loadRouteConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const tmpDir = path.join(__dirname, 'tmp')

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
    await writeFile(path.join(dir, 'routes.json'), JSON.stringify({ routes: [] }))
    await assert.rejects(
      () => loadRouteConfig(dir, {}),
      /Invalid routes\.json.*missing required property 'root'/s
    )
  })

  it('should throw when routes.json fails schema validation (wrong type for root)', async () => {
    const dir = path.join(tmpDir, 'wrong-root-type')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'routes.json'), JSON.stringify({ root: 42, routes: [] }))
    await assert.rejects(
      () => loadRouteConfig(dir, {}),
      /Invalid routes\.json.*expected type 'string'/s
    )
  })

  it('should throw when a route item has an invalid HTTP method in handlers', async () => {
    const dir = path.join(tmpDir, 'bad-method')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'routes.json'), JSON.stringify({
      root: 'test',
      routes: [{ route: '/test', handlers: { badmethod: 'myHandler' } }]
    }))
    await assert.rejects(
      () => loadRouteConfig(dir, {}),
      /Invalid routes\.json.*'badmethod' is not allowed/s
    )
  })

  it('should throw when a route item is missing required fields', async () => {
    const dir = path.join(tmpDir, 'missing-route')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'routes.json'), JSON.stringify({
      root: 'test',
      routes: [{ handlers: { get: 'myHandler' } }]
    }))
    await assert.rejects(
      () => loadRouteConfig(dir, {}),
      /Invalid routes\.json.*missing required property 'route'/s
    )
  })

  it('should use a consumer-provided schema for top-level validation', async () => {
    const schemaDir = path.join(tmpDir, 'consumer-schema')
    await mkdir(schemaDir, { recursive: true })
    // Consumer schema adds 'schemaName' as a required field
    await writeFile(path.join(schemaDir, 'custom.schema.json'), JSON.stringify({
      type: 'object',
      properties: {
        root: { type: 'string' },
        schemaName: { type: 'string' },
        routes: { type: 'array' }
      },
      required: ['root', 'schemaName']
    }))
    const routesDir = path.join(tmpDir, 'consumer-routes')
    await mkdir(routesDir, { recursive: true })
    // Missing schemaName → should throw
    await writeFile(path.join(routesDir, 'routes.json'), JSON.stringify({ root: 'test', routes: [] }))
    await assert.rejects(
      () => loadRouteConfig(routesDir, {}, { schema: 'custom', schemaDir }),
      /Invalid routes\.json.*missing required property 'schemaName'/s
    )
  })
})

