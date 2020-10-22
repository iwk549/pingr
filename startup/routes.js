const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const config = require("config");
const users = require("../routes/usersRoute");
const auth = require("../routes/auth");

const errors = require("../middleware/errors");

module.exports = function (app) {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static("public"));
  app.use(bodyParser.json((options = { limit: "100kb" })));

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: config.get("origin"),
      credentials: true,
    })
  );
  app.use(cookieParser());

  // Routers
  app.use("/api/users", users);
  app.use("/api/auth", auth);

  // Error handling
  app.use(errors);
};
