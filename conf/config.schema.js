module.exports = {
  definition: {
    host: {
      type: 'String',
      required: true,
      description: 'Name of the server host'
    },
    port: {
      type: 'Number',
      required: true,
      description: 'Port to listen for incoming connections'
    },
    url: {
      type: 'String',
      description: 'URL the server can be accessed from'
    }
  }
};
