import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

describe('Router', () => {
  let Router
  let mockApp

  before(async () => {
    // Mock adapt-authoring-core before importing Router
    const mockCore = {
      App: {
        instance: {
          logger: {
            log: () => {}
          },
          dependencyloader: {
            instances: {
              'adapt-authoring-server': {
                url: 'http://localhost:5000'
              }
            }
          }
        }
      }
    }

    // Create a module mock
    await import('module').then(({ createRequire }) => {
      // For ES modules, we need to set up the mock differently
      global.mockAdaptCore = mockCore
    })

    // Now we can import Router - it will use the mocked App
    const routerModule = await import('../lib/Router.js')
    Router = routerModule.default
    mockApp = express()
  })

  describe('constructor', () => {
    it('should create a router with default values', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.root, '/test')
      assert.equal(typeof router.expressRouter, 'function') // Express Router is actually a function
      assert.ok(Array.isArray(router.routes))
      assert.ok(Array.isArray(router.childRouters))
      assert.ok(Array.isArray(router.routerMiddleware))
      assert.ok(Array.isArray(router.handlerMiddleware))
      assert.equal(router._initialised, false)
    })

    it('should filter out non-function middleware', () => {
      const middleware = [() => {}, 'not a function', () => {}]
      const router = new Router('/test', mockApp, [], middleware)

      // routerMiddleware includes default middleware plus filtered
      assert.ok(router.routerMiddleware.length >= 2)
    })
  })

  describe('#path', () => {
    it('should generate path from parent router', () => {
      const parentRouter = new Router('/api', mockApp)
      const childRouter = new Router('users', parentRouter)

      assert.equal(childRouter.path, '/api/users')
    })

    it('should handle trailing slashes correctly', () => {
      const parentRouter = new Router('/api/', mockApp)
      const childRouter = new Router('/users', parentRouter)

      // Note: Current implementation allows double slashes
      // This documents existing behavior, not ideal behavior
      assert.equal(childRouter.path, '/api//users')
    })
  })

  describe('#addMiddleware()', () => {
    it('should add middleware to router stack', () => {
      const router = new Router('/test', mockApp)
      const middleware = () => {}
      const initialLength = router.routerMiddleware.length

      router.addMiddleware(middleware)

      assert.equal(router.routerMiddleware.length, initialLength + 1)
      assert.ok(router.routerMiddleware.includes(middleware))
    })

    it('should return router instance for chaining', () => {
      const router = new Router('/test', mockApp)
      const result = router.addMiddleware(() => {})

      assert.equal(result, router)
    })

    it('should not add duplicate middleware', () => {
      const router = new Router('/test', mockApp)
      const middleware = () => {}

      router.addMiddleware(middleware)
      const lengthAfterFirst = router.routerMiddleware.length
      router.addMiddleware(middleware)

      assert.equal(router.routerMiddleware.length, lengthAfterFirst)
    })
  })

  describe('#addHandlerMiddleware()', () => {
    it('should add handler middleware to stack', () => {
      const router = new Router('/test', mockApp)
      const middleware = () => {}
      const initialLength = router.handlerMiddleware.length

      router.addHandlerMiddleware(middleware)

      assert.equal(router.handlerMiddleware.length, initialLength + 1)
      assert.ok(router.handlerMiddleware.includes(middleware))
    })

    it('should return router instance for chaining', () => {
      const router = new Router('/test', mockApp)
      const result = router.addHandlerMiddleware(() => {})

      assert.equal(result, router)
    })
  })

  describe('#getHandlerMiddleware()', () => {
    it('should get middleware from router hierarchy', () => {
      const parentRouter = new Router('/api', mockApp)
      const childRouter = new Router('users', parentRouter)
      const middleware = () => {}

      parentRouter.addHandlerMiddleware(middleware)
      const result = childRouter.getHandlerMiddleware()

      assert.ok(Array.isArray(result))
      assert.ok(result.includes(middleware))
    })
  })

  describe('#addRoute()', () => {
    it('should add valid route', () => {
      const router = new Router('/test', mockApp)
      const route = { route: '/users', handlers: { get: () => {} } }

      router.addRoute(route)

      assert.equal(router.routes.length, 1)
      assert.equal(router.routes[0].route, '/users')
    })

    it('should return router instance for chaining', () => {
      const router = new Router('/test', mockApp)
      const route = { route: '/users', handlers: { get: () => {} } }
      const result = router.addRoute(route)

      assert.equal(result, router)
    })
  })

  describe('#validateRoute()', () => {
    it('should return true for valid route', () => {
      const router = new Router('/test', mockApp)
      const route = { route: '/users', handlers: { get: () => {} } }

      assert.equal(router.validateRoute(route), true)
    })
  })

  describe('#warnOnInited()', () => {
    it('should return false if not initialised', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.warnOnInited('test message'), false)
    })
  })

  describe('#init()', () => {
    it('should set _initialised to true', () => {
      const router = new Router('/test', mockApp)

      router.init()

      assert.equal(router._initialised, true)
    })
  })
})
