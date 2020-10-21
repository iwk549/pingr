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
  let cookieOptions = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res
    .cookie("jwt", token, cookieOptions)
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
          time: timestamp,
          _id: messageCount.messages.length + "a",
        },
      },
    }
  );
  res.send(user);
});

// Add friend by email
router.post("/friends/add/:email", auth, async (req, res) => {
  const timestamp = new Date().getTime();
  const friend = await User.findOne({ email: req.params.email });
  if (!friend) return res.status(404).send("User was not found.");

  await User.updateOne(
    { _id: req.user._id },
    {
      $set: { lastActive: timestamp },
      $push: {
        friends: {
          _id: friend._id.toString(),
          confirmed: false,
          requestor: true,
        },
      },
    }
  );

  const result = await User.updateOne(
    { email: req.params.email },
    {
      $push: {
        friends: { _id: req.user._id, confirmed: false, requestor: false },
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

router.get("/", auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  delete user.password;
  res.send(_.pick(user, ["messages", "friends"]));
});

module.exports = router;
