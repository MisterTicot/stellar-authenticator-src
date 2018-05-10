import scrypt from 'scrypt-async'
import nacl from 'tweetnacl'
import {decodeBase64, decodeUTF8, encodeBase64, encodeUTF8}
  from 'tweetnacl-util'

const protocol = '1'

const scryptOptionsTable = {
  1: { N: 16384, r: 8, p: 1, dkLen: 32, encoding: 'binary' }
}

const latestScryptOptions = scryptOptionsTable[protocol]

export function makeSalt (length = nacl.secretbox.keyLength) {
  return encodeBase64(nacl.randomBytes(length))
}

export function deriveKey (password, salt, scryptOptions = latestScryptOptions) {
  return new Promise(function (resolve, reject) {
    if (!password || !salt) { throw new Error('Missing argument') }

    if (typeof scryptOptions === 'string') {
      scryptOptions = scryptOptionsTable[scryptOptions]
    }

    try {
      scrypt(password, decodeBase64(salt), scryptOptions, resolve)
    } catch (error) {
      console.log(error)
      reject(error)
    }
  })
}

export async function encryptString (string, key, salt) {
  if (!string || !key) throw new Error('Missing argument')

  if (salt) key = await deriveKey(key, salt)
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const cipherText = nacl.secretbox(decodeUTF8(string), nonce, key)

  return protocol + ':' + encodeBase64(nonce) + ':' + encodeBase64(cipherText)
}

export async function decryptString (encryptedObject, key, salt) {
  if (!encryptedObject || !key) throw new Error('Missing argument')

  let cipherText, nonce, scryptOptions = latestScryptOptions

  if (encryptedObject instanceof Object) {
    scryptOptions = encryptedObject.scryptOptions
    cipherText = decodeBase64(encryptedObject.ciphertext)
    nonce = decodeBase64(encryptedObject.nonce)
    salt = encryptedObject.salt
  } else {
    const temp = encryptedObject.split(':')
    scryptOptions = temp[0]
    nonce = decodeBase64(temp[1])
    cipherText = decodeBase64(temp[2])
    if (temp[3]) salt = temp[3]

    if (protocol !== '1' || !nonce || !cipherText) {
      throw new Error('Invalid encrypted object')
    }
  }

  if (salt) key = await deriveKey(key, salt, scryptOptions)
  const seed = nacl.secretbox.open(cipherText, nonce, key)
  if (!seed) throw new Error('Wrong password')

  return encodeUTF8(seed)
}

export async function encryptObject (object, key, salt) {
  return encryptString(JSON.stringify(object), key, salt)
}

export async function decryptObject (encryptedObject, key, salt) {
  const string = await decryptString(encryptedObject, key, salt)
  return JSON.parse(string)
}
