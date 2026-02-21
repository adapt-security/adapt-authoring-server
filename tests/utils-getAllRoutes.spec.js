import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getAllRoutes } from '../lib/utils/getAllRoutes.js'

describe('getAllRoutes()', () => {
  it('should collect routes from a single router', () => {
    const mockRouter = {
      path: '/api',
      routes: [
        { route: '/users', handlers: { get: () => {}, post: () => {} } },
        { route: '/posts', handlers: { get: () => {} } }
      ],
      flattenRouters: () => [mockRouter]
    }

    const routeMap = getAllRoutes(mockRouter)

    assert.ok(routeMap instanceof Map)
    assert.equal(routeMap.size, 2)
    assert.ok(routeMap.has('/api/users'))
    assert.ok(routeMap.has('/api/posts'))
    assert.ok(routeMap.get('/api/users').has('GET'))
    assert.ok(routeMap.get('/api/users').has('POST'))
    assert.ok(routeMap.get('/api/posts').has('GET'))
  })

  it('should collect routes from multiple routers in hierarchy', () => {
    const childRouter = {
      path: '/api/v1',
      routes: [
        { route: '/items', handlers: { get: () => {} } }
      ]
    }
    const parentRouter = {
      path: '/api',
      routes: [
        { route: '/health', handlers: { get: () => {} } }
      ],
      flattenRouters: () => [parentRouter, childRouter]
    }

    const routeMap = getAllRoutes(parentRouter)

    assert.equal(routeMap.size, 2)
    assert.ok(routeMap.has('/api/health'))
    assert.ok(routeMap.has('/api/v1/items'))
  })

  it('should handle root path "/" by omitting it from the prefix', () => {
    const mockRouter = {
      path: '/',
      routes: [
        { route: '/status', handlers: { get: () => {} } }
      ],
      flattenRouters: () => [mockRouter]
    }

    const routeMap = getAllRoutes(mockRouter)

    assert.ok(routeMap.has('/status'))
  })

  it('should return empty map for router with no routes', () => {
    const mockRouter = {
      path: '/api',
      routes: [],
      flattenRouters: () => [mockRouter]
    }

    const routeMap = getAllRoutes(mockRouter)

    assert.equal(routeMap.size, 0)
  })

  it('should uppercase method names', () => {
    const mockRouter = {
      path: '/api',
      routes: [
        { route: '/data', handlers: { get: () => {}, post: () => {}, delete: () => {} } }
      ],
      flattenRouters: () => [mockRouter]
    }

    const routeMap = getAllRoutes(mockRouter)
    const methods = routeMap.get('/api/data')

    assert.ok(methods.has('GET'))
    assert.ok(methods.has('POST'))
    assert.ok(methods.has('DELETE'))
  })

  it('should merge methods for duplicate paths across routers', () => {
    const router1 = {
      path: '/api',
      routes: [{ route: '/users', handlers: { get: () => {} } }]
    }
    const router2 = {
      path: '/api',
      routes: [{ route: '/users', handlers: { post: () => {} } }]
    }
    const parentRouter = {
      path: '/api',
      routes: [],
      flattenRouters: () => [router1, router2]
    }

    const routeMap = getAllRoutes(parentRouter)

    assert.equal(routeMap.size, 1)
    assert.ok(routeMap.get('/api/users').has('GET'))
    assert.ok(routeMap.get('/api/users').has('POST'))
  })
})
