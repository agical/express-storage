exports.config = {
  host:      (process.env.ES_HOST       === undefined ? 'localhost' : process.env.ES_HOST),
  port:      (process.env.ES_PORT       === undefined ? 80 : process.env.ES_PORT)
};
