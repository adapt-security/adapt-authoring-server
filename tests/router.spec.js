const Router = require('../lib/router');
const should = require('should');

describe('Server router', function() {
  before(function() {
    this.router = new Router('test', { path: 'home', use: () => {} });
  });
  describe('#path()', function() {
    it('should generate the endpoint of the router', function() {
      this.router.path.should.equal('home/test');
    });
  });
  describe('#map()', function() {
    it('should generate a map of endpoints exposed by the router', function() {
      const map = this.router.map;
      map.should.be.an.Object();
      map.should.have.property('test');
      map.test.should.equal(this.router.path);
    });
  });
  describe('#addMiddleware()', function() {
    const m1 = () => 'test1';
    const m2 = () => 'test2';
    const m3 = () => 'test3';
    it('should add a middleware function to the stack', function() {
      this.router.addMiddleware(m1);
      this.router.middleware.should.containEql(m1);
    });
    it('should add multiple middleware functions to the stack', function() {
      this.router.addMiddleware(m1, m2);
      this.router.middleware.should.containEql(m2);
    });
    it('should return router reference so as to be chainable', function() {
      const r = this.router.addMiddleware(m2);
      r.should.equal(this.router);
    });
  });
  describe('#addRoute()', function() {
    const r1 = { route: 'test1', handlers: { get: () => {} } };
    const r2 = { route: 'test2', handlers: { get: () => {} } };
    const r3 = { route: 'test3', handlers: { get: () => {} } };
    it('should add a route function to the stack', function() {
      this.router.addRoute(r1);
      this.router.routes.should.containEql(r1);
    });
    it('should add multiple routes to the stack', function() {
      this.router.addRoute(r1, r2);
      this.router.routes.should.containEql(r2);
    });
    it('should return router reference so as to be chainable', function() {
      const r = this.router.addRoute(r2);
      r.should.equal(this.router);
    });
  });
  describe('#createChildRouter()', function() {
    let r;
    before(function() {
      r = this.router.createChildRouter('child');
    });
    it('should return a router instance', function() {
      r.should.be.instanceof(Router);
    });
    it('should expose specified route', function() {
      r.route.should.equal('child');
    });
    it('should be added to child routers', function() {
      this.router.childRouters.should.containEql(r);
    });
    it('should reference current router as parent', function() {
      r.parentRouter.should.equal(this.router);
    });
  });
  describe('#handleRequest()', function() {
    it('should check something', function() {
      true.should.be.false();
    });
  });
  describe('#genericNotFoundHandler()', function() {
    it('should check something', function() {
      true.should.be.false();
    });
  });
  describe('#genericErrorHandler()', function() {
    it('should check something', function() {
      true.should.be.false();
    });
  });
});
