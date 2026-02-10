/**
 * Mock AbstractModule for testing
 */
class AbstractModuleMock {
  constructor () {
    this.app = {
      onReady: () => Promise.resolve(),
      errors: {}
    }
  }

  async init () {}

  getConfig (key) {
    const config = {
      host: 'localhost',
      port: 5000,
      trustProxy: true,
      url: null
    }
    return config[key]
  }

  log () {}
}

export default AbstractModuleMock
