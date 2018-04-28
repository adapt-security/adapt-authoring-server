module.exports = [
  (req, res, next) => {
    console.log('example express middleware');
    next();
  }
];
