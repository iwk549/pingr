const config = require("config");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
Joi.objectID = require("joi-objectid")(Joi);
const passwordComplexity = require("joi-password-complexity");
const mongoose = require("mongoose");

const pwComplexityOptions = {
  min: 8,
  max: 50,
  lowerCase: 1,
  upperCase: 1,
  numeric: 1,
  symbol: 0,
  requirementCount: 3,
};

const userMongooseSchema = new mongoose.Schema({
  username: { type: String, required: true, minLength: 5, maxLength: 100 },
  email: { type: String, required: true, minLength: 5, maxLength: 255 },
  password: { type: String, required: true, minLength: 8, maxLength: 1024 },
  friends: [{ type: Object, required: false }],
  messages: [{ type: Object, required: false }],
  lastActive: { type: Date, required: false },
});

userMongooseSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
      username: this.username,
      email: this.email,
    },
    config.get("jwtPrivateKey")
  );
  return token;
};

const User = mongoose.model("User", userMongooseSchema);

const userSchema = Joi.object({
  _id: Joi.objectID(),
  username: Joi.string().min(5).max(100).required(),
  email: Joi.string().min(5).max(255).required(),
  password: Joi.string().min(8).max(100).required(),
  friends: Joi.array().items(Joi.object()).optional().allow(null),
  messages: Joi.array().items(Joi.object()).optional().allow(null),
  lastActive: Joi.date().optional().allow(null),
});

function validateUser(user) {
  return userSchema.validate(user);
}

function validatePassword(password) {
  return passwordComplexity(pwComplexityOptions, "Password").validate(password);
}

function validateMessage(message) {
  const messageSchema = Joi.object({
    title: Joi.string().optional().allow(""),
    text: Joi.string().required(),
  });
  return messageSchema.validate(message);
}

exports.validateUser = validateUser;
exports.validatePassword = validatePassword;
exports.validateMessage = validateMessage;
exports.User = User;
