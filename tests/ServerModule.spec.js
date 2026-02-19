import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { Hook } from 'adapt-authoring-core'

describe('ServerModule', () => {
  let ServerModule

  before(async () => {
    ServerModule = (await import('../lib/ServerModule.js')).default
  })

  function createMockApp () {
    return {
      onReady: () => new Promise(() => {}),
      logger: { log: () => {}, name: 'adapt-authoring-logger' },
      dependencyloader: {
        instances: { 'adapt-authoring-server': { url: 'http://localhost:5000' } },
        moduleLoadedHook: new Hook()
      },
      config: {
        get: (key) => {
          const values = {
            'ServerModule.host': 'localhost',
            'ServerModule.port': 5000,
            'ServerModule.trustProxy': true,
            'ServerModule.url': null,
            'ServerModule.verboseErrorLogging': false
          }
          return values[key]
        }
      },
      errors: {
        SERVER_START: { setData: (data) => ({ ...data, statusCode: 500 }) }
      }
    }
  }

  describe('constructor', () => {
    it('should be defined', () => {
      assert.ok(ServerModule)
      assert.equal(typeof ServerModule, 'function')
    })
  })

  describe('#static()', () => {
    it('should return express.static middleware', () => {
      const instance = new ServerModule(createMockApp())
      const middleware = instance.static('/public')

      assert.equal(typeof middleware, 'function')
    })

    it('should accept options parameter', () => {
      const instance = new ServerModule(createMockApp())
      const middleware = instance.static('/public', { maxAge: 3600 })

      assert.equal(typeof middleware, 'function')
    })
  })

  describe('properties', () => {
    it('should have host property from config', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.host, 'localhost')
    })

    it('should have port property from config', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.port, 5000)
    })

    it('should return url from config when set', () => {
      const app = createMockApp()
      const origGet = app.config.get
      app.config.get = (key) => {
        if (key === 'ServerModule.url') return 'http://example.com'
        return origGet(key)
      }
      const instance = new ServerModule(app)

      assert.equal(instance.url, 'http://example.com')
    })

    it('should generate url from host and port when url config is not set', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.url, 'localhost:5000')
    })

    it('should have isListening set to false initially', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.isListening, false)
    })

    it('should have a listeningHook', () => {
      const instance = new ServerModule(createMockApp())

      assert.ok(instance.listeningHook instanceof Hook)
    })

    it('should have a requestHook', () => {
      const instance = new ServerModule(createMockApp())

      assert.ok(instance.requestHook instanceof Hook)
    })

    it('should have an expressApp', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(typeof instance.expressApp, 'function')
    })

    it('should have an api Router', () => {
      const instance = new ServerModule(createMockApp())

      assert.ok(instance.api)
      assert.equal(instance.api.root, '/api')
    })

    it('should have a root Router', () => {
      const instance = new ServerModule(createMockApp())

      assert.ok(instance.root)
      assert.equal(instance.root.root, '/')
    })

    it('should set httpServer to undefined initially', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.httpServer, undefined)
    })

    it('should set isListening to false initially', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.isListening, false)
    })

    it('should set trust proxy on express app', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.expressApp.get('trust proxy'), true)
    })

    it('should set view engine to hbs', () => {
      const instance = new ServerModule(createMockApp())

      assert.equal(instance.expressApp.get('view engine'), 'hbs')
    })
  })

  describe('#close()', () => {
    it('should resolve if httpServer is not set', async () => {
      const instance = new ServerModule(createMockApp())
      instance.httpServer = undefined

      await assert.doesNotReject(() => instance.close())
    })
  })
})
