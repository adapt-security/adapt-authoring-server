# Handling server requests
This page gives you some pointers on how to handle incoming requests in a way that will reduce the work needed by you as a developer, and create consistent and easy-to-process responses. 

## Extend the `AbstractApiModule` class
If you're building a non-trivial API (particularly one that uses the database), we highly recommend that you use `AbstractApiModule` as a base, as this includes a lot of boilerplate code and helper functions to make handling HTTP requests much easier. See [this page](writing-an-api) for more info on using the `AbstractApiModule` class. 

## Use HTTP status codes
This may go without saying, but please stick to standardised HTTP response codes; they state your intentions and make it nice and easy for other devs to work with and react to.

See the [Mozilla Developer Network docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status) for a full list of HTTP response status codes and what they mean.

## Use the built-in error handler
The Server module adds a `sendError` utility function to the ServerResponse object that's passed to every route handler in the stack. Making use of this in your own code will ensure errors are formatted in a consistent way.

Using the helper function is as simple as:

```js
async myHandler(req, res, next) {
  try {
    // do some stuff
  } catch() {
    res.sendError(e);
  }
}
```

See the Express.js documentation for information on the extra functions available:
- [Request](https://expressjs.com/en/4x/api.html#req)
- [Response](https://expressjs.com/en/4x/api.html#res)