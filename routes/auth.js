const express = require("express");
const router = express.Router();
const {
  validateUser,
  validatePassword,
  generateAuthToken,
  User,
} = require("../models/usersModel");
const logger = require("../startup/logging")();
const auth = require("../middleware/auth");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const { setCookies } = require("../utils/cookies");

router.post("/", async (req, res) => {
  const ex = validateLogin(req.body);
  if (ex.error) return res.status(400).send(ex.error.details[0].message);
  const existingUser = await User.findOne({ username: req.body.username });
  if (!existingUser)
    return res.status(400).send("Invalid username or password.");
  const validPassword = await bcrypt.compare(
    req.body.password,
    existingUser.password
  );
  if (!validPassword) res.status(400).send("Invalid username or password.");
  const token = existingUser.generateAuthToken();
  setCookies(res, token);
  res.send("Logged In");
});

router.post("/logout", async (req, res) => {
  const cookieExp = new Date(Date.now());
  let cookieOptions = {
    expires: cookieExp,
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res.cookie("loggedIn", "", { expires: cookieExp });
  res.cookie("jwt", "", cookieOptions);
  res.send("Logged Out");
});

router.get("/", auth, (req, res) => {
  res.send("User is logged in.");
});

function validateLogin(req) {
  const schema = Joi.object({
    username: Joi.string().min(3).max(30).required(),
    password: Joi.string().min(8).max(50).required(),
  });
  return schema.validate(req);
}

module.exports = router;
