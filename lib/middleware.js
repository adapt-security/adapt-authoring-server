module.exports = [
  (req, res, next) => {
    console.log('Server: example express middleware');
    next();
  }
];
