const winston = require("winston");
require("express-async-errors");

module.exports = function () {
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
      new winston.transports.File({ filename: "error.log", level: "error" }),
      new winston.transports.File({ filename: "combined.log" }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: "uncaughtExceptions.log" }),
    ],
  });
  if (process.env.NODE_ENV !== "production") {
    logger.add(
      new winston.transports.Console({ format: winston.format.simple() })
    );
  }
  return logger;
};
