const bodyParser = require('body-parser');
const { Responder } = require('adapt-authoring-core');
/**
* List functions to be used as Express middleware
* @type {function[]}
*/
 function middleware(instance) {
   return {
     preBoot: [
       bodyParser.json(/*{limit: '5mb' }*/),
       bodyParser.urlencoded({ extended: true/*, limit: '50mb'*/ })
     ],
     postBoot: [
       function serverErrorHandler(error, req, res, next) {
         instance.log('error', `Server: uncaught error thrown from route '${req.url}' - ${error.message || error}`);
         instance.log('debug', error.stack);
         new Responder(res).error(error);
       }
     ]
   };
};

module.exports = middleware;
