const express = require("express");
const app = express();

require("./startup/db")();
require("./startup/config")();
require("./startup/routes")(app);
// require("./startup/prod")(app);
const logger = require("./startup/logging")();

console.log(`Pingr database running in ${app.get("env")}`);

const port = process.env.PORT || 3001;
const server = app.listen(port, () =>
  logger.log("info", `Listening on port ${port}`)
);

module.exports = server;
