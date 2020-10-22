const express = require("express");
const router = express.Router();
const {
  validateUser,
  validatePassword,
  validateMessage,
  User,
} = require("../models/usersModel");
const logger = require("../startup/logging")();
const bcrypt = require("bcrypt");
const auth = require("../middleware/auth");
const _ = require("lodash");
const { setCookies } = require("../utils/cookies");

// Create new user
router.post("/", async (req, res) => {
  const ex = validateUser(req.body);
  if (ex.error) return res.status(400).send(ex.error.details[0].message);

  const pw = validatePassword(req.body.password);
  if (pw.error) return res.status(400).send(pw.error.details[0].message);

  const existingUser = await User.findOne({
    $or: [{ email: req.body.email }, { username: req.body.username }],
  });
  if (existingUser) {
    if (existingUser.email === req.body.email)
      return res.status(400).send("Email is already registered.");
    else if (existingUser.username === req.body.username)
      return res.status(400).send("Username is already in use.");
  }

  const user = new User(req.body);
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  const result = await user.save();

  const token = user.generateAuthToken();
  setCookies(res, token);
  res
    .header("x-auth-token", token)
    .header("access-control-expose-headers", "x-auth-token")
    .send(_.pick(result, ["username", "email"]));
});

// Send message to yourself
router.post("/selfmessage", auth, async (req, res) => {
  const ex = validateMessage(req.body);
  if (ex.error) return res.status(400).send(ex.error.details[0].message);
  req.body.title = req.body.title ? req.body.title : null;
  const timestamp = new Date().getTime();
  const messageCount = await User.findById(req.user._id);

  const user = await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        lastActive: timestamp,
      },
      $push: {
        messages: {
          title: req.body.title,
          text: req.body.text,
          from: req.user._id,
          fromName: req.user.username,
          time: timestamp,
          _id: messageCount.messages.length + "a",
        },
      },
    }
  );
  res.send(user);
});

// Send message to friend (id: friend's user id)
router.post("/message/:id", auth, async (req, res) => {
  const ex = validateMessage(req.body);
  if (ex.error) return res.status(400).send(ex.error.details[0].message);
  req.body.title = req.body.title ? req.body.title : null;
  const timestamp = new Date().getTime();
  const messageCount = await User.findById(req.user._id);

  await User.updateOne(
    { _id: req.user._id },
    { $set: { lastActive: timestamp } }
  );

  const user = await User.updateOne(
    { _id: req.params.id },
    {
      $push: {
        messages: {
          title: req.body.title,
          text: req.body.text,
          from: req.user._id,
          fromName: req.user.username,
          time: timestamp,
          _id: messageCount.messages.length + "a",
        },
      },
    }
  );
  res.send(user);
});

// Add friend by username
router.post("/friends/add/:username", auth, async (req, res) => {
  const timestamp = new Date().getTime();
  const friend = await User.findOne({ username: req.params.username });
  if (!friend) return res.status(404).send("User was not found.");
  const user = await User.findById(req.user._id);
  if (user.username === req.params.username)
    return res.status(400).send("You cannot be your own friend.");
  let exists = false;
  let existsMessage = "";
  user.friends.forEach((f) => {
    if (f.username === req.params.username) {
      exists = true;
      existsMessage =
        !f.confirmed && f.requestor
          ? `You already have a friend request pending with ${req.params.username}.`
          : !f.confirmed && !f.requestor
          ? `${req.params.username} has already sent you a friend request. See below to confirm.`
          : `You are already friends with ${req.params.username}.`;
    }
  });

  if (exists) return res.status(400).send(existsMessage);

  await User.updateOne(
    { _id: req.user._id },
    {
      $set: { lastActive: timestamp },
      $push: {
        friends: {
          _id: friend._id.toString(),
          username: friend.username,
          confirmed: false,
          requestor: true,
        },
      },
    }
  );

  const result = await User.updateOne(
    { username: req.params.username },
    {
      $push: {
        friends: {
          _id: req.user._id,
          username: req.user.username,
          confirmed: false,
          requestor: false,
        },
      },
    }
  );
  res.send(result);
});

// Confirm friend
router.put("/friends/confirm/:id", auth, async (req, res) => {
  await User.updateOne(
    { _id: req.params.id, "friends._id": req.user._id },
    { $set: { "friends.$.confirmed": true } }
  );
  const result = await User.updateOne(
    { _id: req.user._id, "friends._id": req.params.id },
    { $set: { "friends.$.confirmed": true } }
  );
  res.send(result);
});

// Delete message by id & timestamp
router.delete("/mymessages/:id/:timestamp", auth, async (req, res) => {
  const timestamp = new Date().getTime();
  const result = await User.updateOne(
    { _id: req.user._id },
    {
      $set: { lastActive: timestamp },
      $pull: {
        messages: {
          $and: [
            { _id: req.params.id },
            { time: Number(req.params.timestamp) },
          ],
        },
      },
    }
  );
  res.send(result);
});

// get all your messages
router.get("/", auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  delete user.password;
  res.send(_.pick(user, ["messages", "friends", "_id", "username"]));
});

module.exports = router;
