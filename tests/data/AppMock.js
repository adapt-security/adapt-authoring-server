/**
 * Mock App for testing
 */
export const App = {
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
