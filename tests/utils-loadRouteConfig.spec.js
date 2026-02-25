import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRouteConfig } from '../lib/utils/loadRouteConfig.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')

describe('loadRouteConfig()', () => {
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
    assert.equal(config.schemaName, 'content')
    assert.equal(config.collectionName, 'content')
    assert.equal(config.useDefaultRoutes, true)
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
    assert.deepEqual(route.permissions, { post: ['write:content'] })
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
})
