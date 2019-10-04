const Router = require('../lib/router');
const should = require('should');

describe('Server router', function() {
  before(function() {
    this.router = new Router('test', { path: 'home' });
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
    it('should not add middleware once initialised', function() {
      (false).should.be.true;;
    });
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

  /**
  * Initialises the API

  init() {
    if(this._initialised) {
      return this.log('warn', App.instance.lang.t('error.routeralreadyinited'));
    }
    if(this.middleware.length) {
      this._router.use(...this.middleware);
    }
    if(this.childRouters.length) {
      this.childRouters.forEach(r => {
        r.init();
        this._router.use(r.route, r._router);
      });
    }
    if(this.routes.length) {
      this.routes.forEach(r => {
        Object.entries(r.handlers).forEach(([method, handler]) => {
          this.log('debug', App.instance.lang.t('info.addroute', { method: method.toUpperCase(), route: this.path+r.route }));
          this._router[method](r.route, this.handleRequest(), handler);
        });
      });
    }
    // some generic error handling
    this._router.all('*', this.genericNotFoundHandler.bind(this));
    this._router.use(this.genericErrorHandler.bind(this));

    if(this.parentRouter instanceof Router) {
      this.parentRouter._router.use(`/${this.route}`, this._router);
    } else {
      const route = (this.route[0] !== '/') ? `/${this.route}` : this.route;
      this.parentRouter.use(route, this._router);
    }
    this._initialised = true;
  }
  handleRequest() {
    return (req, res, next) => {
      App.instance.getModule('server').requestHook.invoke(req)
        .then((d) => next())
        .catch((e) => next(e));
    };
  }
  /**
  * Generic 404 handler for router
  genericNotFoundHandler(req, res, next) {
    new Responder(res).error(App.instance.lang.t('error.routenotfound', { method: req.method, url: req.originalUrl }), { statusCode: 404 });
  }
  /**
  * Catch-all error handler for router
  genericErrorHandler(error, req, res, next) {
    const logStack = App.instance.config.get('adapt-authoring-server.logStackOnError');
    this.log('error', logStack ? error.stack : error.toString());
    new Responder(res).error(error, { statusCode: error.statusCode || 500 });
  }
  /**
  * Logs a message
  log(level, ...args) {
    App.instance.logger.log(level, this.constructor.name.toLowerCase(), ...args);
  }
*/
