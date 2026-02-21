import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateRouterMap } from '../lib/utils/generateRouterMap.js'

describe('generateRouterMap()', () => {
  it('should generate a router map', () => {
    const mockRouter = {
      root: 'api',
      path: '/api',
      url: 'http://localhost:5000/api',
      routes: [
        { route: '/test', handlers: { get: () => {} } }
      ],
      childRouters: [],
      flattenRouters: function () {
        return [this]
      }
    }

    const map = generateRouterMap(mockRouter)

    assert.equal(typeof map, 'object')
  })

  it('should return empty object for router with no routes', () => {
    const mockRouter = {
      root: 'api',
      path: '/api',
      url: 'http://localhost:5000/api',
      routes: [],
      childRouters: [],
      flattenRouters: function () {
        return [this]
      }
    }

    const map = generateRouterMap(mockRouter)

    assert.deepEqual(map, {})
  })

  it('should include endpoint URLs and accepted methods', () => {
    const mockRouter = {
      root: 'api',
      route: '/api',
      path: '/api',
      url: 'http://localhost:5000/api',
      routes: [
        { route: '/users', handlers: { get: () => {}, post: () => {} }, meta: { get: { description: 'list users' } } }
      ],
      childRouters: [],
      parentRouter: null,
      flattenRouters: function () {
        return [this]
      }
    }

    const map = generateRouterMap(mockRouter)
    const keys = Object.keys(map)

    assert.ok(keys.length > 0)
    const endpoints = map[keys[0]]
    assert.ok(Array.isArray(endpoints))
    assert.equal(endpoints[0].url, 'http://localhost:5000/api/users')
    assert.ok('get' in endpoints[0].accepted_methods)
    assert.ok('post' in endpoints[0].accepted_methods)
    assert.deepEqual(endpoints[0].accepted_methods.get, { description: 'list users' })
    assert.deepEqual(endpoints[0].accepted_methods.post, {})
  })

  it('should use relative route keys for child routers', () => {
    const childRouter = {
      root: 'users',
      path: '/api/users',
      url: 'http://localhost:5000/api/users',
      routes: [
        { route: '/:id', handlers: { get: () => {} } }
      ],
      childRouters: [],
      parentRouter: null
    }
    const mockRouter = {
      root: 'api',
      route: '/api',
      path: '/api',
      url: 'http://localhost:5000/api',
      routes: [],
      childRouters: [childRouter],
      flattenRouters: function () {
        return [this, childRouter]
      }
    }
    childRouter.parentRouter = mockRouter

    const map = generateRouterMap(mockRouter)
    const keys = Object.keys(map)

    assert.ok(keys.some(k => k.includes('users')))
  })

  it('should sort routers alphabetically by root', () => {
    const routerB = {
      root: 'b-router',
      path: '/api/b-router',
      url: 'http://localhost:5000/api/b-router',
      routes: [{ route: '/data', handlers: { get: () => {} } }],
      childRouters: [],
      parentRouter: null
    }
    const routerA = {
      root: 'a-router',
      path: '/api/a-router',
      url: 'http://localhost:5000/api/a-router',
      routes: [{ route: '/data', handlers: { get: () => {} } }],
      childRouters: [],
      parentRouter: null
    }
    const mockRouter = {
      root: 'api',
      route: '/api',
      path: '/api',
      url: 'http://localhost:5000/api',
      routes: [],
      childRouters: [routerB, routerA],
      flattenRouters: function () {
        return [routerB, routerA]
      }
    }
    routerA.parentRouter = mockRouter
    routerB.parentRouter = mockRouter

    const map = generateRouterMap(mockRouter)
    const keys = Object.keys(map)

    assert.ok(keys[0].includes('a-router'))
    assert.ok(keys[1].includes('b-router'))
  })
})
