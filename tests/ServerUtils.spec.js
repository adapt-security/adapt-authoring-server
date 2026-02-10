import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ServerUtils from '../lib/ServerUtils.js'

describe('ServerUtils', () => {
  describe('#addExistenceProps()', () => {
    it('should set hasBody, hasParams, hasQuery to false for empty objects', () => {
      const req = { method: 'POST', body: {}, params: {}, query: {} }
      const res = {}
      let nextCalled = false
      const next = () => { nextCalled = true }

      ServerUtils.addExistenceProps(req, res, next)

      assert.equal(req.hasBody, false)
      assert.equal(req.hasParams, false)
      assert.equal(req.hasQuery, false)
      assert.equal(nextCalled, true)
    })

    it('should set hasBody, hasParams, hasQuery to true for populated objects', () => {
      const req = { method: 'POST', body: { foo: 'bar' }, params: { id: '123' }, query: { search: 'test' } }
      const res = {}
      let nextCalled = false
      const next = () => { nextCalled = true }

      ServerUtils.addExistenceProps(req, res, next)

      assert.equal(req.hasBody, true)
      assert.equal(req.hasParams, true)
      assert.equal(req.hasQuery, true)
      assert.equal(nextCalled, true)
    })

    it('should remove undefined and null values from request objects', () => {
      const req = { method: 'POST', body: { foo: 'bar', baz: undefined, qux: null }, params: {}, query: {} }
      const res = {}
      const next = () => {}

      ServerUtils.addExistenceProps(req, res, next)

      assert.equal(req.body.foo, 'bar')
      assert.equal(req.body.baz, undefined)
      assert.equal(req.body.qux, undefined)
      assert.equal(req.hasBody, true)
    })

    it('should clear body for GET requests', () => {
      const req = { method: 'GET', body: { foo: 'bar' }, params: {}, query: {} }
      const res = {}
      const next = () => {}

      ServerUtils.addExistenceProps(req, res, next)

      assert.deepEqual(req.body, {})
      assert.equal(req.hasBody, false)
    })
  })

  describe('#cacheRouteConfig()', () => {
    it('should cache route config on request object', () => {
      const routeConfig = { route: '/test', handlers: {}, internal: false }
      const middleware = ServerUtils.cacheRouteConfig(routeConfig)
      const req = {}
      const res = {}
      let nextCalled = false
      const next = () => { nextCalled = true }

      middleware(req, res, next)

      assert.equal(req.routeConfig, routeConfig)
      assert.equal(nextCalled, true)
    })
  })

  describe('#addErrorHandler()', () => {
    it('should add sendError method to response object', () => {
      const req = {}
      const res = {}
      let nextCalled = false
      const next = () => { nextCalled = true }

      ServerUtils.addErrorHandler(req, res, next)

      assert.equal(typeof res.sendError, 'function')
      assert.equal(nextCalled, true)
    })
  })

  describe('#mapHandler()', () => {
    it('should return a function', () => {
      const mockRouter = { map: { test: 'data' } }
      const handler = ServerUtils.mapHandler(mockRouter)

      assert.equal(typeof handler, 'function')
    })

    it('should respond with router map', () => {
      const mockRouter = { map: { test: 'data' } }
      const handler = ServerUtils.mapHandler(mockRouter)
      const req = {}
      let responseData = null
      const res = {
        json: (data) => { responseData = data }
      }

      handler(req, res)

      assert.deepEqual(responseData, { test: 'data' })
    })
  })

  describe('#getAllRoutes()', () => {
    it('should collect routes from router hierarchy', () => {
      const mockRouter = {
        path: '/api',
        routes: [
          { route: '/users', handlers: { get: () => {}, post: () => {} } },
          { route: '/posts', handlers: { get: () => {} } }
        ],
        flattenRouters: () => [mockRouter]
      }

      const routeMap = ServerUtils.getAllRoutes(mockRouter)

      assert.ok(routeMap instanceof Map)
      assert.equal(routeMap.size, 2)
      assert.ok(routeMap.has('/api/users'))
      assert.ok(routeMap.has('/api/posts'))
      assert.ok(routeMap.get('/api/users').has('GET'))
      assert.ok(routeMap.get('/api/users').has('POST'))
      assert.ok(routeMap.get('/api/posts').has('GET'))
    })
  })

  describe('#generateRouterMap()', () => {
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

      const map = ServerUtils.generateRouterMap(mockRouter)

      assert.equal(typeof map, 'object')
    })
  })
})
