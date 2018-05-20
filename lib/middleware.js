/**
* List functions to be used as Express middleware
* @type {function[]}
*/
export const middleware = [
  (req, res, next) => {
    console.log('Server: example express middleware');
    next();
  }
];
