const mongoose = require("mongoose");

const Version = mongoose.model(
  "Version",
  new mongoose.Schema({
    full: { type: String, required: true },
  })
);

exports.Version = Version;
