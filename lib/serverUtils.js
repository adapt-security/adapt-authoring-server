const { Responder } = require('adapt-authoring-core');

class ServerUtils {
  static mapHandler(topRouter) {
    return (req, res) => {
      const map = flattenRouters(topRouter)
        .sort((a,b) => a.route.localeCompare(b.route))
        .reduce((m,r) => {
          return {
            ...m,
            [`${getRelativeRoute(topRouter, r)}endpoints`]: getEndpoints(r)
          }
        }, {});

      new Responder(res).success(map);
    }
  }
}

function flattenRouters(r) {
  return r.childRouters.reduce((a,c) => {
    if(c.childRouters) a.push(c, ...flattenRouters(c));
    return a;
  }, []);
}
function getEndpoints(r) {
  return r.routes.map(route => {
    return {
      url: `${r.url}${route.route}`,
      accepted_methods: Object.keys(route.handlers)
    };
  });
}
function getRelativeRoute(relFrom, relTo) {
  let route = '';
  for(let r = relTo; r !== relFrom; r = r.parentRouter) route = `${r.route}_${route}`;
  return route;
}

module.exports = ServerUtils;
