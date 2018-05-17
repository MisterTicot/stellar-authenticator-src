import { deriveKey, encryptString, decryptString, encryptObject, decryptObject,
  makeSalt } from './crypto'
import {encodeBase64, decodeBase64} from 'tweetnacl-util'
import {timeout} from './cosmic-lib/helpers'

function shareSessionStorage (event) {
  if (!event.newValue) return
  if (
    event.key === 'getSessionStorage' &&
    sessionStorage.length &&
    !localStorage.sessionStorage
  ) {
    localStorage.sessionStorage = JSON.stringify(sessionStorage)
    delete localStorage.sessionStorage
  } else if (event.key === 'sessionStorage' && !sessionStorage.length) {
    const data = JSON.parse(event.newValue)
    sessionStorage.username = data.username
    sessionStorage.userkey = data.userkey
  } else if (event.key.substr(-9) === '_database' || event.key === 'logout') {
    sessionStorage.clear()
    location.reload()
  } else if (event.key === 'login' && !sessionStorage.length) {
    location.reload()
  }
}

if (!sessionStorage.length) localStorage.getSessionStorage = Date.now()
delete localStorage.getSessionStorage
window.addEventListener('storage', shareSessionStorage)

export class Database {
  /**
   * Create a Database object using provided parameters. This should not be used
   * directly, use `Database.new` or `Database.load` instead.
   *
   * @contructor
   * @param {string} username The user name
   * @param {Uint8Array} key The database key
   * @param {string} salt The database salt, base64 encoded
   * @param {Object} table The database content
   * @return {Database} A Database object
   */
  constructor (username, key, salt, table, protocol = '1') {
    sessionStorage.username = username
    sessionStorage.userkey = encodeBase64(key)
    this.username = username
    this.key = key
    this.salt = salt
    this.table = table
    this.protocol = protocol
    localStorage.login = true
    delete localStorage.login
  }

  /**
   * Create a new Database object protected by `password` for `username`.
   *
   * @param {string} username The user name
   * @param {string} password The user password
   * @return {Database} The user new Database object
   */
  static async new (username, password = '') {
    if (localStorage[username + '_database']) throw new Error('User already exist')
    const salt = makeSalt()
    const concat = concatCredentials(username, password)
    const key = await deriveKey(concat, salt)
    const seedsKey = await makeSeedsKey(concat, salt)
    const table = { version: 1, seedsKey: seedsKey, accounts: {}, contacts: {} }
    const db = new Database(username, key, salt, table)
    await db.save()
    return db
  }

  /**
   * Returns `username`'s Database object decrypted from `encrypted` using
   * `password`.
   *
   * @param {string} username The user name
   * @param {string} password The user password
   * @param {string} encrypted The encrypted database
   * @return {Database} The decrypted Database object
   */
  static async open (username, password, encrypted) {
    const concat = concatCredentials(username, password)
    const [salt, encryptedTable] = encrypted.split(',')
    const [protocol] = encryptedTable.split(':')
    const key = await deriveKey(concat, salt, protocol)
    const table = await decryptObject(encryptedTable, key)
    return new Database(username, key, salt, table, protocol)
  }

  /**
   * Return a database upgraded from alpha format.
   *
   * @param {string} username The user name
   * @param {string} password The user password
   * @return {Database} The decrypted Database object
   */
  static async upgrade (username, password) {
    return upgrade(username, password)
  }

  static async load (username, password) {
    const encrypted = localStorage[username + '_database']
    if (!encrypted) {
      throw new Error("Can't find database for user: " + username)
    }
    return Database.open(username, password, encrypted)
  }

  /**
   * Return the current session database, if any. Else, return `undefined`.
   */
  static async current () {
    if (!sessionStorage.userkey) await timeout(50)
    if (!sessionStorage.userkey) {
      delete localStorage.guest_database
      return undefined
    }
    const username = sessionStorage.username
    const key = decodeBase64(sessionStorage.userkey)
    const encrypted = localStorage[username + '_database']
    const [salt, encryptedTable] = encrypted.split(',')
    const table = await decryptObject(encryptedTable, key)
    return new Database(username, key, salt, table)
  }

  async save () {
    const encrypted = await encryptObject(this.table, this.key)
    localStorage[this.username + '_database'] = this.salt + ',' + encrypted
  }

  logout () {
    sessionStorage.clear()
    delete localStorage.guest_database
    for (let item in this) this[item] = undefined
    localStorage.logout = true
    delete localStorage.logout
  }

  /// Change password
  async changePassword (password, newPassword) {
    const seedsKey = encodeBase64(await this.seedsKey(password))
    const concat = concatCredentials(this.username, newPassword)
    const salt = makeSalt()
    const key = await deriveKey(concat, salt)
    const encryptedSeedsKey = await encryptString(seedsKey, 'seeds' + concat, salt)
    this.table.seedsKey = encryptedSeedsKey

    this.salt = salt
    this.key = key
    sessionStorage.userkey = encodeBase64(key)
    await this.save()
  }

  async seedsKey (password = '') {
    const concat = 'seeds' + concatCredentials(this.username, password)
    const key = await decryptString(this.table.seedsKey, concat, this.salt)
    return decodeBase64(key)
  }

  async addAccount (password, name, seed, network = 'public') {
    this.checkAccountDoesntExist(name)

    const publicKey = seedToPublicKey(seed)
    const seedsKey = await this.seedsKey(password)
    const encryptedSeed = await encryptString(seed, seedsKey)
    this.accounts[name] = { id: publicKey, seed: encryptedSeed, network: network }
    await this.save()
  }

  async newAccount (password, name, network = 'public') {
    const keypair = StellarSdk.Keypair.random()
    await this.addAccount(password, name, keypair.secret(), network)
  }

  async removeAccount (password, name) {
    this.checkAccountExist(name)
    await this.checkPassword(password)
    delete this.table.accounts[name]
    await this.save()
  }

  /// Retrieve datas
  get accounts () { return this.table.accounts }
  get contact () { return this.table.contacts }
  get aliases () { return this.table.accounts.concat(this.table.contacts) }
  get version () { return this.table.version }

  static listUsers () {
    const array = []
    Object.keys(localStorage).forEach(entry => {
      if (entry.substr(-9) === '_database') array.push(entry.substr(0, entry.length - 9))
    })
    return sortCI(array)
  }

  listAccounts () {
    return sortCI(Object.keys(this.accounts))
  }

  async secretSeed (password, ...names) {
    names.forEach(name => this.checkAccountExist(name))
    const seedsKey = await this.seedsKey(password)
    const seeds = []
    for (let index in names) {
      const account = names[index]
      const seed = await decryptString(this.accounts[account].seed, seedsKey)
      seeds.push(seed)
    }
    if (seeds.length === 1) return seeds[0]
    else return seeds
  }

  async keypair (password, name = this.current) {
    const secretSeed = await this.secretSeed(password, name)
    return StellarSdk.Keypair.fromSecret(secretSeed)
  }

  publicKey (name = this.current) {
    this.checkAccountExist(name)
    return this.accounts[name].id
  }

  network (name = this.current) {
    this.checkAccountExist(name)
    return this.accounts[name].network
  }

  accountName (publicKey, network) {
    for (let account in this.accounts) {
      if (
        this.accounts[account].id === publicKey
        && this.accounts[account].network === network
      ) {
        return account
      }
    }
    return undefined
  }

  /// Import / Export
  async exportAccount (password, name) {
    this.checkAccountExist(name)
    const seedsKey = await this.seedsKey(password)
    const seed = await decryptString(this.accounts[name].seed, seedsKey)
    const account = [name, seed, this.accounts[name].network]
    const encryptedAccount = await encryptObject(account, seedsKey)
    return encryptedAccount
  }

  async importAccount (password, encryptedAccount) {
    const seedsKey = await this.seedsKey(password)
    const account = await decryptObject(encryptedAccount, seedsKey)
    const [name, seed, network] = account
    this.checkAccountDoesntExist(name)
    const publicKey = seedToPublicKey(seed)
    const encryptedSeed = await encryptString(seed, seedsKey)
    this.accounts[name] = { id: publicKey, seed: encryptedSeed, network: network }
    this.save()
  }

  async backup (password) {
    await this.checkPassword(password)
    return localStorage[this.username + '_database']
  }

  async delete (password) {
    await this.checkPassword(password)
    delete localStorage[this.username + '_database']
    this.logout()
  }

  /// Checks
  async checkPassword (password) {
    await this.seedsKey(password)
  }

  checkAccountExist (name) {
    checkNonEmptyName(name)
    if (!this.accounts[name]) throw new Error("Account doesn't exist: " + name)
  }

  checkAccountDoesntExist (name) {
    checkNonEmptyName(name)
    if (this.accounts[name]) throw new Error('Account already exist: ' + name)
  }
}

function checkNonEmptyName (name) {
  if (!name) throw new Error('Missing name')
}

function concatCredentials (username, password) {
  return username.toLowerCase() + '[*…*]' + password
}

async function makeSeedsKey (concat, salt) {
  const key = makeSalt()
  return encryptString(key, 'seeds' + concat, salt)
}

function seedToPublicKey (seed) {
  try {
    const keypair = StellarSdk.Keypair.fromSecret(seed)
    return keypair.publicKey(keypair)
  } catch (error) {
    console.log(error)
    throw new Error('Invalid secret seed')
  }
}

function sortCI (array) {
  return array.sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))
}

/** ********************** Upgrade from alpha databases ************************/
/// Will stay there for a year (until 10/05/2019)

async function upgrade (username, password) {
  const accounts = await getAccountsFromOldDb(password)
  const db = await Database.new(username, password)
  for (let index in accounts) {
    let [name, seed, network] = accounts[index]
    if (db.accounts[name]) name += ' (2)'
    await db.addAccount(password, name, seed, network)
  }
  return db
}

async function getAccountsFromOldDb (password) {
  const oldDatabase = JSON.parse(localStorage.accounts)
  const seeds = oldDatabase.private.slice(1)
  const accounts = []
  for (let index in seeds) {
    const encrypted = seeds[index]
    const datas = await decryptObject(encrypted, password)
    const secret = datas[1]
    let name, network
    if (datas[0].substr(0, 7) === '(test) ') {
      name = datas[0].substr(7)
      network = 'test'
    } else if (datas[0].substr(0, 10) === '(testnet) ') {
      name = datas[0].substr(10)
      network = 'test'
    } else {
      name = datas[0]
      network = 'public'
    }
    accounts.push([name, secret, network])
  }
  return accounts
}
