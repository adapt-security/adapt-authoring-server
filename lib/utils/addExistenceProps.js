import _ from 'lodash'

/**
 * Adds extra properties to the request object to allow for easy existence checking of common request objects
 * @param {external:ExpressRequest} req
 * @param {external:ExpressResponse} res
 * @param {Function} next
 * @memberof server
 * @example
 * "IMPORTANT NOTE: body data is completely ignored for GET requests, any code
 * requiring it should switch to use POST."
 *
 * let req = { 'params': { 'foo':'bar' }, 'query': {}, 'body': {} };
 * req.hasParams // true
 * req.hasQuery // false
 * req.hasBody // false
 */
export function addExistenceProps (req, res, next) {
  if (req.method === 'GET') {
    req.body = {}
  }
  const storeVal = (key, exists) => {
    req[`has${_.capitalize(key)}`] = exists
  }
  ;['body', 'params', 'query'].forEach(attr => {
    if (!req[attr]) {
      return storeVal(attr, false)
    }
    const entries = Object.entries(req[attr])
    let deleted = 0
    if (entries.length === 0) {
      return storeVal(attr, false)
    }
    entries.forEach(([key, val]) => {
      if (val === undefined || val === null) {
        delete req[attr][key]
        deleted++
      }
    })
    storeVal(attr, deleted < entries.length)
  })
  next()
}
