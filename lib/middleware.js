const bodyParser = require('body-parser');
const { Responder } = require('adapt-authoring-core');
/**
* List functions to be used as Express middleware
* @type {function[]}
*/
 const middleware = {
  preBoot: [
    bodyParser.json(/*{limit: '5mb' }*/),
    bodyParser.urlencoded({ extended: true/*, limit: '50mb'*/ })
  ],
  postBoot: [
    function serverErrorHandler(error, req, res, next) {
      console.log(`SERVER ERROR FALL-THROUGH: ${req.url}`);
      console.log(error.stack);
      Responder(res).error(error);
    }
  ]
};

module.exports = middleware;
