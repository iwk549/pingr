const crypto = require("crypto");
const config = require("config");

const algorithm = config.get("algorithm");
const key = config.get("algoKey");
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return {
    iv: iv.toString("hex"),
    content: encrypted.toString("hex"),
  };
}

function decrypt(hash) {
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(hash.iv, "hex")
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(hash.content, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString();
}

module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
