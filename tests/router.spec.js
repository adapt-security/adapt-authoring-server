const assert = require('assert');

describe('Server router', function() {
  after(function() {
    // any set-up should go here
  });
  describe('#path()', function() {
    // ???
    it('should check something', function() {
      assert(false);
    });
  });
  describe('#map()', function() {
    // ???
  });
  describe('#addMiddleware()', function() {
    // middleware added to stack
    // accepts multiple params
    // errors after initalise
    // chainable
  });
  describe('#addRoute()', function() {
    // route added to stack
    // accepts multiple params
    // errors after initalise
    // chainable
  });
  describe('#createChildRouter()', function() {
    // returns a router instance
    // has specified route
    // added to child routers
    // this is parent
  });
  describe('#init()', function() {
    // ???
  });
  after(function() {
    // any clean-up should go here
  });
});
