const crypto = exports

const nacl = require("tweetnacl")
const scrypt = require("scrypt-async")
const utils = require("tweetnacl-util")

/**
 * Current protocol protocol.
 */
crypto.protocol = "1"

/**
 * Scrypt options history.
 */
crypto.optionsTable = {
  1: { N: 16384, r: 8, p: 1, dkLen: 32, encoding: "binary" }
}

/**
 * Default scrypt options.
 */
crypto.options = crypto.optionsTable[crypto.protocol]

/**
 * Returns `length` random bytes formatted in base64.
 *
 * @param {integer} [length = nacl.secretbox.keyLength]
 * @return {string}
 */
crypto.makeSalt = function (length = nacl.secretbox.keyLength) {
  return utils.encodeBase64(nacl.randomBytes(length))
}

/**
 * Derive `password` using `salt`.
 *
 * @async
 * @param {string} password
 * @param {string} salt Base64 formatted.
 * @param {Object} [options=crypto.options] Scrypt options
 * @return {Buffer}
 */
crypto.deriveKey = function (password, salt, options = crypto.options) {
  return new Promise(function (resolve, reject) {
    if (!password || !salt) {
      throw new Error("Missing argument")
    }

    if (typeof options === "string") {
      options = crypto.optionsTable[options]
    }

    try {
      scrypt(password, utils.decodeBase64(salt), options, resolve)
    } catch (error) {
      console.error(error)
      reject(error)
    }
  })
}

/**
 * Encrypt `string` using `key`. When `salt` is provided, use it to derive
 * `key`.
 *
 * @param {string} string
 * @param {string} key Base64 formatted
 * @param {string} salt Base64 formatted
 * @return {string} Encrypted `string`
 */
crypto.encryptString = async function (string, key, salt) {
  if (!string || !key) throw new Error("Missing argument")

  if (salt) key = await crypto.deriveKey(key, salt)
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const cipherText = nacl.secretbox(utils.decodeUTF8(string), nonce, key)

  return (
    crypto.protocol
    + ":"
    + utils.encodeBase64(nonce)
    + ":"
    + utils.encodeBase64(cipherText)
  )
}

/**
 * Decrypt `encrypted` string. `encrypted` can be either a keystore (StellarPort
 * format) or a keystring (@cosmic-plus format).
 *
 * @param {string|Object} encrypted
 * @param {string} key Base64 formatted
 * @paman {string} [salt] Base64 formatted; May be retrieved from keystring.
 * @return {string} The decrypted string
 */
crypto.decryptString = async function (encrypted, key, salt) {
  if (!encrypted || !key) throw new Error("Missing argument")

  let protocol, options, cipherText, nonce

  if (encrypted instanceof Object) {
    /// Decrypt keystore (StellarPort format).
    options = encrypted.scryptOptions
    cipherText = utils.decodeBase64(encrypted.ciphertext)
    nonce = utils.decodeBase64(encrypted.nonce)
    salt = encrypted.salt
  } else {
    /// Decrypt keystring (@cosmic-plus format).
    const temp = encrypted.split(":")
    protocol = temp[0]
    options = crypto.optionsTable[protocol]
    nonce = utils.decodeBase64(temp[1])
    cipherText = utils.decodeBase64(temp[2])
    if (temp[3]) salt = temp[3]

    if (!options || !nonce || !cipherText) {
      throw new Error("Invalid encrypted object")
    }
  }

  if (salt) key = await crypto.deriveKey(key, salt, options)
  const seed = nacl.secretbox.open(cipherText, nonce, key)
  if (!seed) throw new Error("Wrong password")

  return utils.encodeUTF8(seed)
}

/**
 * Encrypt `string` using `key`. When `salt` is provided, use it to derive
 * `key`.
 *
 * @async
 * @param {Object} object
 * @param {string} key Base64 formatted
 * @param {string} salt Base64 formatted
 * @return {string} Encrypted `string`
 */
crypto.encryptObject = function (object, key, salt) {
  return crypto.encryptString(JSON.stringify(object), key, salt)
}

/**
 * Decrypt `encrypted` object. `encrypted` can be either a keystore (StellarPort
 * format) or a keystring (@cosmic-plus format).
 *
 * @async
 * @param {string|Object} encrypted
 * @param {string} key Base64 formatted
 * @paman {string} [salt] Base64 formatted; May be retrieved from keystring.
 * @return {Object} The decrypted object.
 */
crypto.decryptObject = function (encrypted, key, salt) {
  return crypto.decryptString(encrypted, key, salt).then(x => JSON.parse(x))
}
