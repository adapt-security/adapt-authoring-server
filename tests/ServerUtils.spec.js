import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { App } from 'adapt-authoring-core'

describe('ServerUtils', () => {
  let ServerUtils

  before(async () => {
    const app = App.instance
    app.logger = { log: () => {}, name: 'adapt-authoring-logger' }
    app.dependencyloader.instances = app.dependencyloader.instances || {}
    app.dependencyloader.instances['adapt-authoring-server'] = { url: 'http://localhost:5000' }
    await app.onReady().catch(() => {})
    process.exitCode = 0

    ServerUtils = (await import('../lib/ServerUtils.js')).default
  })

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

    it('should handle falsy attr values (missing body/params/query)', () => {
      const req = { method: 'POST', body: null, params: undefined, query: false }
      const res = {}
      const next = () => {}

      ServerUtils.addExistenceProps(req, res, next)

      assert.equal(req.hasBody, true)
      assert.equal(req.hasParams, true)
      assert.equal(req.hasQuery, true)
    })

    it('should mark has* false when all entries are null or undefined', () => {
      const req = { method: 'POST', body: { a: null, b: undefined }, params: {}, query: {} }
      const res = {}
      const next = () => {}

      ServerUtils.addExistenceProps(req, res, next)

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

    it('should return a middleware function', () => {
      const middleware = ServerUtils.cacheRouteConfig({})

      assert.equal(typeof middleware, 'function')
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

    it('sendError should send AdaptError as JSON with status code', () => {
      const req = { translate: (error) => error.message }
      const res = {}
      const next = () => {}

      ServerUtils.addErrorHandler(req, res, next)

      let statusCode
      let jsonData
      res.status = (code) => { statusCode = code; return res }
      res.json = (data) => { jsonData = data }

      const adaptError = {
        constructor: { name: 'AdaptError' },
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Not found'
      }
      res.sendError(adaptError)

      assert.equal(statusCode, 404)
      assert.equal(jsonData.code, 'NOT_FOUND')
      assert.equal(jsonData.message, 'Not found')
    })

    it('sendError should fall back to SERVER_ERROR for unknown errors', () => {
      App.instance.errors = App.instance.errors || {}
      App.instance.errors.SERVER_ERROR = {
        constructor: { name: 'AdaptError' },
        statusCode: 500,
        code: 'SERVER_ERROR',
        message: 'Internal server error'
      }

      const req = { translate: (error) => error.message }
      const res = {}
      const next = () => {}

      ServerUtils.addErrorHandler(req, res, next)

      let statusCode
      let jsonData
      res.status = (code) => { statusCode = code; return res }
      res.json = (data) => { jsonData = data }

      res.sendError(new Error('something broke'))

      assert.equal(statusCode, 500)
      assert.equal(jsonData.code, 'SERVER_ERROR')
    })

    it('sendError should look up known error codes on non-AdaptError', () => {
      App.instance.errors = App.instance.errors || {}
      App.instance.errors.CUSTOM_CODE = {
        statusCode: 422,
        code: 'CUSTOM_CODE',
        message: 'Custom error'
      }

      const req = { translate: (error) => error.message }
      const res = {}
      const next = () => {}

      ServerUtils.addErrorHandler(req, res, next)

      let statusCode
      let jsonData
      res.status = (code) => { statusCode = code; return res }
      res.json = (data) => { jsonData = data }

      const error = new Error('details')
      error.code = 'CUSTOM_CODE'
      res.sendError(error)

      assert.equal(statusCode, 422)
      assert.equal(jsonData.code, 'CUSTOM_CODE')
    })

    it('sendError should include data field in response', () => {
      const req = { translate: (error) => error.message }
      const res = {}
      const next = () => {}

      ServerUtils.addErrorHandler(req, res, next)

      let jsonData
      res.status = () => res
      res.json = (data) => { jsonData = data }

      const adaptError = {
        constructor: { name: 'AdaptError' },
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Bad request',
        data: { field: 'email' }
      }
      res.sendError(adaptError)

      assert.deepEqual(jsonData.data, { field: 'email' })
    })

    it('sendError should use error.message when req.translate is not available', () => {
      const req = {}
      const res = {}
      const next = () => {}

      ServerUtils.addErrorHandler(req, res, next)

      let jsonData
      res.status = () => res
      res.json = (data) => { jsonData = data }

      const adaptError = {
        constructor: { name: 'AdaptError' },
        statusCode: 500,
        code: 'ERR',
        message: 'fallback message'
      }
      res.sendError(adaptError)

      assert.equal(jsonData.message, 'fallback message')
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

      const routeMap = ServerUtils.getAllRoutes(parentRouter)

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

      const routeMap = ServerUtils.getAllRoutes(mockRouter)

      assert.ok(routeMap.has('/status'))
    })

    it('should return empty map for router with no routes', () => {
      const mockRouter = {
        path: '/api',
        routes: [],
        flattenRouters: () => [mockRouter]
      }

      const routeMap = ServerUtils.getAllRoutes(mockRouter)

      assert.equal(routeMap.size, 0)
    })
  })

  describe('#methodNotAllowedHandler()', () => {
    it('should return a middleware function', () => {
      const mockRouter = {
        path: '/api',
        routes: [],
        flattenRouters: () => [mockRouter]
      }
      const handler = ServerUtils.methodNotAllowedHandler(mockRouter)

      assert.equal(typeof handler, 'function')
    })

    it('should call next() when route is not found', () => {
      const mockRouter = {
        path: '/api',
        routes: [
          { route: '/users', handlers: { get: () => {} } }
        ],
        flattenRouters: () => [mockRouter]
      }
      const handler = ServerUtils.methodNotAllowedHandler(mockRouter)
      let nextCalled = false

      handler({ method: 'GET', path: '/unknown', originalUrl: '/api/unknown' }, {}, () => { nextCalled = true })

      assert.equal(nextCalled, true)
    })

    it('should call next() when method matches', () => {
      const mockRouter = {
        path: '/api',
        routes: [
          { route: '/users', handlers: { get: () => {} } }
        ],
        flattenRouters: () => [mockRouter]
      }
      const handler = ServerUtils.methodNotAllowedHandler(mockRouter)
      let nextCalled = false
      let nextError = null

      handler(
        { method: 'GET', path: '/api/users', originalUrl: '/api/users' },
        {},
        (err) => { nextCalled = true; nextError = err }
      )

      assert.equal(nextCalled, true)
      assert.equal(nextError, undefined)
    })

    it('should call next with METHOD_NOT_ALLOWED when path exists but method does not match', () => {
      const mockError = { code: 'METHOD_NOT_ALLOWED' }
      App.instance.errors = App.instance.errors || {}
      App.instance.errors.METHOD_NOT_ALLOWED = { setData: () => mockError }

      const mockRouter = {
        path: '/api',
        routes: [
          { route: '/users', handlers: { get: () => {}, post: () => {} } }
        ],
        flattenRouters: () => [mockRouter]
      }
      const handler = ServerUtils.methodNotAllowedHandler(mockRouter)
      let nextError = null

      handler(
        { method: 'DELETE', path: '/api/users', originalUrl: '/api/users' },
        {},
        (err) => { nextError = err }
      )

      assert.equal(nextError.code, 'METHOD_NOT_ALLOWED')
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

      const map = ServerUtils.generateRouterMap(mockRouter)

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

      const map = ServerUtils.generateRouterMap(mockRouter)
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

      const map = ServerUtils.generateRouterMap(mockRouter)
      const keys = Object.keys(map)

      assert.ok(keys.some(k => k.includes('users')))
    })
  })

  describe('#rootNotFoundHandler()', () => {
    it('should respond with NOT_FOUND status code', () => {
      App.instance.errors = App.instance.errors || {}
      App.instance.errors.NOT_FOUND = { statusCode: 404 }

      let statusCode
      let endCalled = false
      const res = {
        status: (code) => { statusCode = code; return res },
        end: () => { endCalled = true }
      }

      ServerUtils.rootNotFoundHandler({}, res)

      assert.equal(statusCode, 404)
      assert.equal(endCalled, true)
    })
  })

  describe('#apiNotFoundHandler()', () => {
    it('should call next with ENDPOINT_NOT_FOUND error', () => {
      const mockError = { code: 'ENDPOINT_NOT_FOUND' }
      App.instance.errors = App.instance.errors || {}
      App.instance.errors.ENDPOINT_NOT_FOUND = { setData: () => mockError }

      let nextArg
      ServerUtils.apiNotFoundHandler(
        { originalUrl: '/api/missing', method: 'GET' },
        {},
        (err) => { nextArg = err }
      )

      assert.equal(nextArg.code, 'ENDPOINT_NOT_FOUND')
    })
  })
})
