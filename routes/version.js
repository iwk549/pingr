const express = require("express");
const router = express.Router();
const config = require("config");
const { Version } = require("../models/versionModel");

router.get("/", async (req, res) => {
  const versionID = config.get("version");
  const version = await Version.findById(versionID);
  res.send(version.full);
});

module.exports = router;
