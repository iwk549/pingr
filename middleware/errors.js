const logger = require("../startup/logging")();

module.exports = function (err, req, res, next) {
  logger.log("error", err.message);
  return res.status(500).send("Could not connect to the server.");
};
