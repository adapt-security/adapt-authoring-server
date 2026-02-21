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
