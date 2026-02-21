import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cacheRouteConfig } from '../lib/utils/cacheRouteConfig.js'

describe('cacheRouteConfig()', () => {
  it('should return a middleware function', () => {
    const middleware = cacheRouteConfig({})

    assert.equal(typeof middleware, 'function')
  })

  it('should cache route config on request object', () => {
    const routeConfig = { route: '/test', handlers: {}, internal: false }
    const middleware = cacheRouteConfig(routeConfig)
    const req = {}
    const res = {}
    let nextCalled = false
    const next = () => { nextCalled = true }

    middleware(req, res, next)

    assert.equal(req.routeConfig, routeConfig)
    assert.equal(nextCalled, true)
  })

  it('should always call next()', () => {
    const middleware = cacheRouteConfig({})
    const req = {}
    const res = {}
    let nextCalled = false
    const next = () => { nextCalled = true }

    middleware(req, res, next)

    assert.equal(nextCalled, true)
  })

  it('should store the exact config reference', () => {
    const config = { route: '/specific', internal: true }
    const middleware = cacheRouteConfig(config)
    const req = {}

    middleware(req, {}, () => {})

    assert.equal(req.routeConfig, config)
    assert.equal(req.routeConfig.internal, true)
  })
})
