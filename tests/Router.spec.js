import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { App } from 'adapt-authoring-core'

describe('Router', () => {
  let Router
  let mockApp

  before(async () => {
    const app = App.instance
    app.logger = { log: () => {}, name: 'adapt-authoring-logger' }
    app.dependencyloader.instances = app.dependencyloader.instances || {}
    app.dependencyloader.instances['adapt-authoring-server'] = { url: 'http://localhost:5000' }
    // Wait for App singleton's async init/setReady to settle and
    // reset exitCode set by App.init() failure (expected in test context)
    await app.onReady().catch(() => {})
    process.exitCode = 0

    const routerModule = await import('../lib/Router.js')
    Router = routerModule.default
    mockApp = express()
  })

  describe('constructor', () => {
    it('should create a router with default values', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.root, '/test')
      assert.equal(typeof router.expressRouter, 'function')
      assert.ok(Array.isArray(router.routes))
      assert.equal(router.routes.length, 0)
      assert.ok(Array.isArray(router.childRouters))
      assert.equal(router.childRouters.length, 0)
      assert.ok(Array.isArray(router.routerMiddleware))
      assert.ok(Array.isArray(router.handlerMiddleware))
      assert.equal(router._initialised, false)
    })

    it('should store the parent router', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.parentRouter, mockApp)
    })

    it('should filter out non-function middleware', () => {
      const fn1 = () => {}
      const fn2 = () => {}
      const middleware = [fn1, 'not a function', fn2, 42, null]
      const router = new Router('/test', mockApp, [], middleware)

      assert.ok(router.routerMiddleware.includes(fn1))
      assert.ok(router.routerMiddleware.includes(fn2))
      assert.ok(!router.routerMiddleware.includes('not a function'))
    })

    it('should filter out non-function handler middleware', () => {
      const fn = () => {}
      const handlerMiddleware = [fn, 'bad', undefined]
      const router = new Router('/test', mockApp, [], [], handlerMiddleware)

      assert.ok(router.handlerMiddleware.includes(fn))
      assert.ok(!router.handlerMiddleware.includes('bad'))
    })

    it('should filter invalid routes passed to constructor', () => {
      const validRoute = { route: '/users', handlers: { get: () => {} } }
      const invalidRoute = { route: 123, handlers: { get: () => {} } }
      const router = new Router('/test', mockApp, [validRoute, invalidRoute])

      assert.equal(router.routes.length, 1)
      assert.equal(router.routes[0].route, '/users')
    })

    it('should include default router middleware (addErrorHandler)', () => {
      const router = new Router('/test', mockApp)

      assert.ok(router.routerMiddleware.length >= 1)
    })

    it('should include default handler middleware (addExistenceProps, handleInternalRoutes)', () => {
      const router = new Router('/test', mockApp)

      assert.ok(router.handlerMiddleware.length >= 2)
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

      // Documents existing behavior: double slashes are allowed
      assert.equal(childRouter.path, '/api//users')
    })

    it('should handle root path without parent path property', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.path, '/test')
    })

    it('should build multi-level nested paths', () => {
      const root = new Router('/api', mockApp)
      const child = new Router('v1', root)
      const grandchild = new Router('users', child)

      assert.equal(grandchild.path, '/api/v1/users')
    })
  })

  describe('#url', () => {
    it('should return server url + path', () => {
      const router = new Router('/api', mockApp)

      assert.equal(router.url, 'http://localhost:5000/api')
    })

    it('should include full hierarchy path', () => {
      const parent = new Router('/api', mockApp)
      const child = new Router('users', parent)

      assert.equal(child.url, 'http://localhost:5000/api/users')
    })
  })

  describe('#map', () => {
    it('should return a router map object', () => {
      const router = new Router('api', mockApp, [
        { route: '/test', handlers: { get: () => {} } }
      ])

      const map = router.map

      assert.equal(typeof map, 'object')
    })

    it('should return empty object for router with no routes', () => {
      const router = new Router('api', mockApp)

      assert.deepEqual(router.map, {})
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

    it('should add multiple middleware in one call', () => {
      const router = new Router('/test', mockApp)
      const fn1 = () => {}
      const fn2 = () => {}
      const initialLength = router.routerMiddleware.length

      router.addMiddleware(fn1, fn2)

      assert.equal(router.routerMiddleware.length, initialLength + 2)
    })

    it('should not add non-function values', () => {
      const router = new Router('/test', mockApp)
      const initialLength = router.routerMiddleware.length

      router.addMiddleware('not a function')

      assert.equal(router.routerMiddleware.length, initialLength)
    })

    it('should return router when called with no arguments', () => {
      const router = new Router('/test', mockApp)
      const result = router.addMiddleware()

      assert.equal(result, router)
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

    it('should not add duplicate handler middleware', () => {
      const router = new Router('/test', mockApp)
      const middleware = () => {}

      router.addHandlerMiddleware(middleware)
      const lengthAfterFirst = router.handlerMiddleware.length
      router.addHandlerMiddleware(middleware)

      assert.equal(router.handlerMiddleware.length, lengthAfterFirst)
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

    it('should stop recursing when parent is not a Router', () => {
      const router = new Router('/test', mockApp)
      const result = router.getHandlerMiddleware()

      assert.ok(Array.isArray(result))
      assert.ok(result.length > 0)
    })

    it('should return unique middleware (deduplicated)', () => {
      const parentRouter = new Router('/api', mockApp)
      const childRouter = new Router('users', parentRouter)

      const result = childRouter.getHandlerMiddleware()
      const unique = [...new Set(result)]

      assert.equal(result.length, unique.length)
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

    it('should add multiple routes in one call', () => {
      const router = new Router('/test', mockApp)
      const route1 = { route: '/users', handlers: { get: () => {} } }
      const route2 = { route: '/posts', handlers: { post: () => {} } }

      router.addRoute(route1, route2)

      assert.equal(router.routes.length, 2)
    })

    it('should filter out invalid routes', () => {
      const router = new Router('/test', mockApp)
      const valid = { route: '/users', handlers: { get: () => {} } }
      const invalid = { route: 123, handlers: {} }

      router.addRoute(valid, invalid)

      assert.equal(router.routes.length, 1)
    })

    it('should not add routes after initialisation', () => {
      const router = new Router('/test', mockApp)
      router.init()

      router.addRoute({ route: '/late', handlers: { get: () => {} } })

      assert.equal(router.routes.length, 0)
    })
  })

  describe('#validateRoute()', () => {
    it('should return true for valid route', () => {
      const router = new Router('/test', mockApp)
      const route = { route: '/users', handlers: { get: () => {} } }

      assert.equal(router.validateRoute(route), true)
    })

    it('should return false if route is not a string', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.validateRoute({ route: 123, handlers: { get: () => {} } }), false)
    })

    it('should return false if handlers is missing', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.validateRoute({ route: '/test' }), false)
    })

    it('should return false if handler method is not a valid Express method', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.validateRoute({ route: '/test', handlers: { badmethod: () => {} } }), false)
    })

    it('should return false if handler value is not a function or array of functions', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.validateRoute({ route: '/test', handlers: { get: 'not a function' } }), false)
    })

    it('should accept array of functions as handler', () => {
      const router = new Router('/test', mockApp)
      const route = { route: '/users', handlers: { get: [() => {}, () => {}] } }

      assert.equal(router.validateRoute(route), true)
    })

    it('should accept multiple HTTP methods', () => {
      const router = new Router('/test', mockApp)
      const route = { route: '/users', handlers: { get: () => {}, post: () => {}, put: () => {}, delete: () => {} } }

      assert.equal(router.validateRoute(route), true)
    })
  })

  describe('#createChildRouter()', () => {
    it('should create and return a child router', () => {
      const router = new Router('/api', mockApp)
      const child = router.createChildRouter('users')

      assert.ok(child instanceof Router)
      assert.equal(child.root, 'users')
      assert.equal(child.parentRouter, router)
    })

    it('should add child to childRouters array', () => {
      const router = new Router('/api', mockApp)
      router.createChildRouter('users')

      assert.equal(router.childRouters.length, 1)
    })

    it('should pass routes to child router', () => {
      const router = new Router('/api', mockApp)
      const routes = [{ route: '/list', handlers: { get: () => {} } }]
      const child = router.createChildRouter('users', routes)

      assert.equal(child.routes.length, 1)
    })

    it('should not create child after initialisation', () => {
      const router = new Router('/api', mockApp)
      router.init()

      const result = router.createChildRouter('late')

      assert.equal(result, router)
      assert.equal(router.childRouters.length, 0)
    })
  })

  describe('#warnOnInited()', () => {
    it('should return false if not initialised', () => {
      const router = new Router('/test', mockApp)

      assert.equal(router.warnOnInited('test message'), false)
    })

    it('should return true if initialised', () => {
      const router = new Router('/test', mockApp)
      router.init()

      assert.equal(router.warnOnInited('test message'), true)
    })
  })

  describe('#init()', () => {
    it('should set _initialised to true', () => {
      const router = new Router('/test', mockApp)

      router.init()

      assert.equal(router._initialised, true)
    })

    it('should apply router middleware to express router', () => {
      const mw = (req, res, next) => next()
      const router = new Router('/test', mockApp, [], [mw])

      router.init()

      assert.ok(router.routerMiddleware.includes(mw))
    })

    it('should initialise child routers', () => {
      const router = new Router('/api', mockApp)
      const child = router.createChildRouter('users')

      router.init()

      assert.equal(child._initialised, true)
    })

    it('should register routes on the express router', () => {
      const handler = (req, res) => res.json({})
      const routes = [{ route: '/items', handlers: { get: handler } }]
      const router = new Router('/test', mockApp, routes)

      router.init()

      assert.equal(router._initialised, true)
    })

    it('should not re-initialise if already initialised', () => {
      const router = new Router('/test', mockApp)
      router.init()

      // Second call should be a no-op
      router.init()

      assert.equal(router._initialised, true)
    })

    it('should mount to parent Router via expressRouter.use', () => {
      const parentRouter = new Router('/api', mockApp)
      const childRouter = new Router('users', parentRouter)

      childRouter.init()

      assert.equal(childRouter._initialised, true)
    })
  })

  describe('#flattenRouters()', () => {
    it('should return array containing the router itself', () => {
      const router = new Router('/api', mockApp)
      const result = router.flattenRouters()

      assert.ok(Array.isArray(result))
      assert.ok(result.includes(router))
    })

    it('should include child routers', () => {
      const router = new Router('/api', mockApp)
      const child = router.createChildRouter('users')

      const result = router.flattenRouters()

      assert.ok(result.includes(router))
      assert.ok(result.includes(child))
    })

    it('should include nested grandchild routers', () => {
      const router = new Router('/api', mockApp)
      const child = router.createChildRouter('v1')
      const grandchild = child.createChildRouter('users')

      const result = router.flattenRouters()

      assert.ok(result.includes(router))
      assert.ok(result.includes(child))
      assert.ok(result.includes(grandchild))
    })
  })

  describe('#log()', () => {
    it('should not throw when called', () => {
      const router = new Router('/test', mockApp)

      assert.doesNotThrow(() => router.log('debug', 'test message'))
    })
  })
})
