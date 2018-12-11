/**
* List functions to be used as Express middleware
* @type {function[]}
*/
 const middleware = {
  preBoot: [
    (req, res, next) => {
      console.log('Server: example express middleware');
      next();
    }
  ],
  postBoot: [
    (error, req, res, next) => {
      console.log(`ERROR: ${req.url}`);
      console.trace(error);
    }
  ]
};

module.exports = middleware;
