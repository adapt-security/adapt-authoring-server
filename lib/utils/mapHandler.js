/**
 * Handler for returning an API map
 * @param {Router} topRouter
 * @return {Function} Middleware function
 * @memberof server
 */
export function mapHandler (topRouter) {
  return (req, res) => res.json(topRouter.map)
}
