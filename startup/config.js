const config = require("config");

module.exports = function () {
  if (!config.get("jwtPrivateKey"))
    throw new Error("FATAL ERROR: jwtPrivateKey is not defined");
  if (!config.get("db"))
    throw new Error("FATAL ERROR: database is not defined");
  if (!config.get("origin"))
    throw new Error("FATAL ERROR: request origin is not defined");
  if (!config.get("algorithm") || !config.get("algoKey"))
    throw new Error("FATAL ERROR: algorithm is not defined");
};
