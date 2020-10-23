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
const { encrypt, decrypt } = require("../utils/encryption");

// Create new user
router.post("/", async (req, res) => {
  const ex = validateUser(req.body);
  if (ex.error) return res.status(400).send(ex.error.details[0].message);

  const pw = validatePassword(req.body.password);
  if (pw.error) return res.status(400).send(pw.error.details[0].message);

  const existingUser = await User.findOne({ username: req.body.username });
  if (existingUser) {
    if (existingUser.username === req.body.username)
      return res.status(400).send("Username is already in use.");
  }

  const user = new User(req.body);
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  const result = await user.save();

  const token = user.generateAuthToken();
  setCookies(res, token);
  res.send(_.pick(result, ["username"]));
});

// Send message to yourself
router.post("/selfmessage", auth, async (req, res) => {
  const ex = validateMessage(req.body);
  if (ex.error) return res.status(400).send(ex.error.details[0].message);
  req.body.text = encrypt(req.body.text);
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
          text: req.body.text,
          from: req.user._id,
          fromName: req.user.username,
          to: req.user._id,
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
  req.body.text = encrypt(req.body.text);
  const timestamp = new Date().getTime();
  const messageCount = await User.findById(req.user._id);
  const recipient = await User.findById(req.params.id);
  if (!recipient) return res.status(404).send("Recipient does not exist.");

  await User.updateOne(
    { _id: req.user._id },
    {
      $set: { lastActive: timestamp },
      $push: {
        messages: {
          text: req.body.text,
          from: req.user._id,
          fromName: req.user.username,
          to: req.params.id,
          toName: recipient.username,
          time: timestamp,
          _id: messageCount.messages.length + "a",
        },
      },
    }
  );

  const user = await User.updateOne(
    { _id: req.params.id },
    {
      $push: {
        messages: {
          text: req.body.text,
          from: req.user._id,
          fromName: req.user.username,
          to: req.params.id,
          toName: recipient.username,
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

// Reject Friend Request or Remove Friend
router.delete("/friends/delete/:id", auth, async (req, res) => {
  await User.updateOne(
    { _id: req.params.id },
    { $pull: { friends: { _id: req.user._id } } }
  );
  const result = await User.updateOne(
    { _id: req.user._id },
    { $pull: { friends: { _id: req.params.id } } }
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

// get all your messages - delete all messages over 30 days old
router.get("/", auth, async (req, res) => {
  const deleteStamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
  await User.updateOne(
    { _id: req.user._id },
    { $pull: { messages: { time: { $lt: deleteStamp } } } }
  );
  const user = await User.findById(req.user._id);
  user.messages.forEach((m) => {
    m.text = decrypt(m.text);
  });
  delete user.password;
  res.send(_.pick(user, ["messages", "friends", "_id", "username"]));
});

module.exports = router;
