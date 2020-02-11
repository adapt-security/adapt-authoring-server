const { Hook } = require('adapt-authoring-core');
const Router = require('../lib/router');
const ServerModule = require('../lib/serverModule');
const should = require('should');
const supertest = require('supertest');

describe('Server module', function() {
  before(function() {
    this.server = new ServerModule(global.ADAPT.app, { name: require('../package.json').name });
  });
  describe('#constructor()', function() {
    it('should expose the Express application', function() {
      false.should.be.true();
    });
    it('should expose a `root` Router', function() {
      this.server.root.should.be.an.instanceof(Router);
    });
    it('should expose an `api` Router', function() {
      this.server.api.should.be.an.instanceof(Router);
    });
    it('should expose a hook to modify requests', function() {
      this.server.requestHook.should.be.an.instanceof(Hook);
    });
  });
  describe('#url()', function() {
    it('should return the URL of the server', function() {
      this.server.url.should.be.a.String();
    });
  });
  describe('#static()', function() {
    it('should expose Express#static', function() {
      false.should.be.true();
    });
  });
  describe('#listen()', function() {
    it('should accept requests on the specified URL/port', function(done) {
      supertest(this.server.expressApp)
        .get(`${this.server.api.path}`)
        .expect(200)
        .end(done);
    });
    it('should not accept requests on unspecified URLs/ports', function(done) {
      false.should.be.true();
    });
  });
  describe('#close()', function() {
    it('should stop accepting requests', function() {
      false.should.be.true();
    });
  });
});
