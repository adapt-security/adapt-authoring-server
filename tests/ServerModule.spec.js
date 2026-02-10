import { describe, it, before, mock } from 'node:test'
import assert from 'node:assert/strict'

describe('ServerModule', () => {
  let ServerModule

  before(async () => {
    // Mock dependencies before importing ServerModule
    global.App = {
      instance: {
        logger: {
          log: mock.fn(() => {})
        },
        dependencyloader: {
          instances: {
            'adapt-authoring-server': {
              url: 'http://localhost:5000'
            }
          }
        },
        onReady: () => Promise.resolve(),
        errors: {
          SERVER_START: {
            setData: (data) => ({ ...data, statusCode: 500 })
          }
        }
      }
    }

    // Mock AbstractModule
    const { default: AbstractModuleMock } = await import('../tests/data/AbstractModuleMock.js')
    global.AbstractModule = AbstractModuleMock
    global.Hook = class Hook {
      constructor () {
        this.callbacks = []
      }

      tap (fn) {
        this.callbacks.push(fn)
      }

      untap (fn) {
        const index = this.callbacks.indexOf(fn)
        if (index > -1) this.callbacks.splice(index, 1)
      }

      invoke () {
        this.callbacks.forEach(cb => cb())
      }
    }

    ServerModule = (await import('../lib/ServerModule.js')).default
  })

  describe('constructor', () => {
    it('should be defined', () => {
      assert.ok(ServerModule)
      assert.equal(typeof ServerModule, 'function')
    })
  })

  describe('#static()', () => {
    it('should return express.static middleware', () => {
      const instance = new ServerModule()
      const middleware = instance.static('/public')

      assert.equal(typeof middleware, 'function')
    })
  })

  describe('properties', () => {
    it('should have host property', () => {
      const instance = new ServerModule()
      instance.getConfig = () => 'localhost'

      assert.equal(instance.host, 'localhost')
    })

    it('should have port property', () => {
      const instance = new ServerModule()
      instance.getConfig = () => 5000

      assert.equal(instance.port, 5000)
    })

    it('should have url property from config', () => {
      const instance = new ServerModule()
      instance.getConfig = (key) => {
        if (key === 'url') return 'http://example.com'
        return ''
      }

      assert.equal(instance.url, 'http://example.com')
    })

    it('should generate url from host and port if not in config', () => {
      const instance = new ServerModule()
      instance.getConfig = (key) => {
        if (key === 'url') return null
        if (key === 'host') return 'localhost'
        if (key === 'port') return 5000
        return ''
      }

      assert.equal(instance.url, 'localhost:5000')
    })
  })
})
