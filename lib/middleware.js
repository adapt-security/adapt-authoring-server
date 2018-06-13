/**
* List functions to be used as Express middleware
* @type {function[]}
*/
 const middleware = [
  (req, res, next) => {
    console.log('Server: example express middleware');
    next();
  }
];

module.exports = middleware;
