import {CosmicLink} from './cosmic-lib'
import {Form} from './form'
import {Popup, passwordPopup} from './popup'
import {Database} from './database'
import {Notification} from './notifications'
import {download, readFile} from './helpers'

import * as node from './cosmic-lib/node'

const global = {
  cosmicLink: null,
  db: null,
  query: null,
  xdr: null,
  history: 0
}

/** * helpers ***/
const publicServer = new StellarSdk.Server('https://horizon.stellar.org')
const testingServer = new StellarSdk.Server('https://horizon-testnet.stellar.org')

function getServer (network) {
  switch (network) {
    case undefined:
    case 'public': return publicServer
    case 'test': return testingServer
    default: throw new Error('Invalid network: ' + network)
  }
}

async function accountExist (publicKey, network) {
  try {
    await getServer(network).loadAccount(publicKey)
    return true
  } catch (error) {
    return false
  }
}

/** ************************* Login in *****************************************/

const mainNode = node.grab('main')
const welcomePage = node.grab('#welcome')

export async function init () {
  global.db = await Database.current()
  if (localStorage.accounts && !localStorage.upgraded) {
    upgrade()
  } else if (global.db) open()
  else if (localStorage.length) login()
  else selectPage(welcomePage)
}

function login () {
  const selectNode = makeUserSelector()

  if (selectNode.length === 0) {
    selectPage(welcomePage)
    return
  }

  /// Fix password autofill
  selectNode.onchange = () => {
    usernameNode.value = selectNode.value
    const passwordNode = popup.inputs.password
    passwordNode.name = ''
    const newNode = node.create('input', {
      name: 'password',
      type: 'password',
      placeholder: 'Authenticator password'
    })
    popup.node.insertBefore(newNode, passwordNode)
    popup.inputs.password = newNode
    node.destroy(passwordNode)
  }

  const last = localStorage.lastSelectedUser
  if (last) selectNode.selectedIndex = last

  const popup = new Popup('Please enter your password to start', true)
  const inputs = popup.inputs
  const usernameNode = node.create('input', {
    readonly: true,
    value: selectNode.value,
    name: 'username'
  })
  node.hide(usernameNode)

  popup.addNode('usernameSelector', selectNode)
    .addNode('', usernameNode)
    .addPasswordBox('password')
    .addSubmit('Open')
    .addSeparator()
    .addNode('', node.create('a', { onclick: () => newUser(popup) }, 'New user'))
    .addNode('', ' | ')
    .addNode('', node.create('a', { onclick: () => importUser(popup) }, 'Import user'))
    .select()
    .addValidator(async function () {
      await popup.setInfo('Opening your session...')
      localStorage.lastSelectedUser = inputs.usernameSelector.selectedIndex
      const username = inputs.usernameSelector.value
      const password = inputs.password.value
      global.db = await Database.load(username, password)
      popup.destroy()
      open()
    })
  inputs.password.focus()
}

function makeUserSelector () {
  const selectNode = node.create('select')
  const usernames = Database.listUsers()
  usernames.forEach(user => {
    node.append(selectNode, node.create('option', { value: user }, user))
  })
  return selectNode
}

export function newUser (loginPopup) {
  const popup = new Popup('Please pick a name and a password', loginPopup)
  popup.addTextBox('username', 'Username')
    .addPasswordBox('password', 'Authenticator password')
    .addPasswordBox('password2', 'Password confirmation')
    .addCancelConfirmButtons()
    .addValidator(async () => {
      const username = popup.inputs.username.value
      const password = popup.inputs.password.value
      const confirmation = popup.inputs.password2.value
      if (password !== confirmation) throw new Error('Password mismatch')

      await popup.setInfo('Creating user...')
      global.db = await Database.new(username, password)
      await global.db.newAccount(password, username)
      if (loginPopup) loginPopup.destroy()
      open()
    })

  if (loginPopup) {
    loginPopup.hide()
    popup.inputs.cancel.onclick = function () {
      popup.onExit()
      loginPopup.show()
    }
  }
}

export function importUser (loginPopup) {
  const popup = new Popup('Import user', loginPopup)
  popup.putInfoNode()
    .addFileSelector('file', 'Select backup')
    .addTextBox('username', 'Username')
    .addPasswordBox('password', 'User password')
    .addCancelConfirmButtons()
    .addValidator(async () => {
      const user = popup.inputs.username.value
      const password = popup.inputs.password.value

      if (localStorage[user + '_database']) {
        throw new Error("There's already an user called: " + user)
      }

      await popup.setInfo('Loading user...')
      const encrypted = await readFile(popup.inputs.file.files[0])
      global.db = await Database.open(user, password, encrypted)
      await global.db.save()
      if (loginPopup) loginPopup.destroy()
      open()
    })

  const prevHandler = popup.inputs.file.onchange
  popup.inputs.file.onchange = function () {
    prevHandler()
    const filename = popup.inputs.file.value.replace(/^.*\\/, '')
    if (filename.substr(-5) === '.user' && !popup.inputs.username.value) {
      popup.inputs.username.value = filename.substr(0, filename.length - 5)
      popup.inputs.password.focus()
    }
  }

  if (loginPopup) {
    loginPopup.hide()
    popup.inputs.cancel.onclick = function () {
      popup.onExit()
      loginPopup.show()
    }
  }
}

const passwordNode = node.grab('#password')

export async function demoVersion () {
  global.db = await Database.new('guest', 'demo')
  await global.db.newAccount('demo', 'guest', 'test')
  sessionStorage.demo = 'true'
  open()
}

async function upgrade () {
  const popup = new Popup('Database upgrade', true)
  popup.addMessage(`Stellar Authenticator has been upgraded and the secure
      database has been rewritten. In order to switch to the new format, please
      provide an username and your password.`)
    .addSeparator()
    .putInfoNode()
    .addTextBox('user', 'Username')
    .addPasswordBox('password', 'Authenticator password')
    .addSubmit()
    .addValidator(async () => {
      await popup.setInfo('Upgrading database...')
      const username = popup.inputs.user.value
      const password = popup.inputs.password.value
      global.db = await Database.upgrade(username, password)
      localStorage[username + '_lastSelected'] = localStorage.index - 1
      localStorage.upgraded = 'true'
      open()
    })
}

function open () {
  headerShowAccounts()
  footerShowAbout()
  if (sessionStorage.demo) passwordNode.textContent = 'The password is: demo'
  refreshPage()
}

function handleQuery () {
  if (location.search === '?about') {
    about()
    return
  }

  headerShowAccounts()
  showMessages()
  footerShowAbout()

  if (location.search.length > 1) {
    resetReadTransactionPage()
    parseQuery(location.search)
  } else {
    resetOpenTransactionPage()
    selectPage(openTransactionPage)
  }
}

const openTransactionPage = node.grab('#openTransaction')
const readTransactionPage = node.grab('#readTransaction')

/** **************************** Open transaction ******************************/

const openUriForm = new Form(node.grab('#openUri'))
  .addValidator(() => {
    const uri = openUriForm.inputs.uri.value
    const query = uri.replace(/^[^?]*/, '')
    if (query < 2) throw new Error('Not a transaction link')
    pushQuery(query)
  })

const openXdrForm = new Form(node.grab('#openXdr'))
  .addValidator(() => {
    try {
      const xdr = openXdrForm.inputs.xdr.value
      new StellarSdk.Transaction(xdr)
      pushQuery('?xdr=' + xdr)
    } catch (error) {
      console.log(error)
      throw new Error('Invalid XDR')
    }
  })

function resetOpenTransactionPage () {
  openUriForm.reset()
  openXdrForm.reset()
}

/** ***************************** Read transaction *****************************/

const transactionNode = node.grab('#CL_transactionNode')

async function parseQuery (query) {
  selectPage(readTransactionPage)
  const account = currentAccount()
  const network = account && global.db.network(account)
  const publicKey = account && global.db.publicKey(account)
  global.cosmicLink = new CosmicLink(query, network, publicKey)

  if (query.substr(0, 1) === '?') {
    try {
      const uri = await global.cosmicLink.getUri()
      uriBox.value = uri
    } catch (error) {
      uriBox.value = 'https://cosmic.link/' + query
    }
  } else uriBox.value = query

  if (!account) {
    const tdesc = await global.cosmicLink.getTdesc()
    if (tdesc.source) {
      try { xdrBox.value = await global.cosmicLink.getXdr() } catch (error) { xdrBox.placeholder = error.message }
    } else {
      xdrBox.placeholder = 'No source account selected'
    }
    return
  }

  const loadingMsg = new Notification('loading', 'Loading account...')
  let exist = await accountExist(publicKey, network)
  loadingMsg.destroy()
  if (currentAccount() !== account) return

  if (!exist) {
    if (network !== 'test') {
      new Notification('warning', 'Empty account')
      xdrBox.placeholder = "Can't compute transaction for empty account"
      return
    }
    await fundTestAccount(publicKey)
  }

  try {
    const xdr = await global.cosmicLink.getXdr()
    if (currentAccount() !== account) return
    xdrBox.value = xdr
    signingButton.disabled = false
  } catch (error) {
    xdrBox.placeholder = error.message
  }
}

function fundTestAccount (publicKey) {
  return new Promise(function (resolve, reject) {
    const account = currentAccount()
    const fundingMsg = new Notification('loading', 'Funding testnet account...')

    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'https://friendbot.stellar.org/?addr=' + publicKey, true)
    xhr.send()
    xhr.onloadend = function () {
      fundingMsg.destroy()
      if (currentAccount() !== account) return
      if (xhr.readyState === 4 && xhr.status === 200) {
        new Notification('done', 'Testnet account funded')
        resolve()
      } else {
        console.log(xhr.response)
        new Notification('warning', "Can't fund account",
          'For some reason, Stellar friend bot could not fund your testnet account.'
        )
        reject()
      }
    }
  })
}

const uriViewerForm = new Form(node.grab('#uriViewer'))
const uriBox = uriViewerForm.inputs.uri
const xdrViewerForm = new Form(node.grab('#xdrViewer'))
const xdrBox = xdrViewerForm.inputs.xdr
const signingButton = node.grab('#signingButton')
signingButton.disabled = true

export function signAndSend () {
  const popup = passwordPopup(global.db.username, 'Sign & send')
  popup.addValidator(async password => {
    await popup.setInfo('Signing transaction...')
    const account = currentAccount()
    const seed = await global.db.secretSeed(password, account)
    signingButton.disabled = true
    global.cosmicLink.sign(seed)
    global.cosmicLink.send()
  })
}

export function closeTransaction () {
  delete global.cosmicLink
  popQuery()
}

function resetReadTransactionPage () {
  node.clear(transactionNode)
  uriViewerForm.reset()
  xdrViewerForm.reset()
  xdrBox.placeholder = 'Computing...'
  signingButton.disabled = true
}

/** ****************************** History *************************************/

export function pushQuery (query) {
  history.pushState(null, '', query)
  global.history++
  handleQuery()
}

export function popQuery () {
  if (document.referrer || global.history) {
    global.history--
    history.back()
  } else {
    history.replaceState(null, '', '?')
    handleQuery()
  }
}

window.onpopstate = function () {
  if (global.db) handleQuery()
}

/** ********************* Header & account selection ***************************/

const accountSelector = node.grab('#accountSelector')
const publicKeyNode = node.grab('#publicKey')
const notificationsNode = node.grab('#notifications')

function refreshPage () {
  refreshAccountSelector()
  refreshPublicKey()
}

export function selectAccount (account) {
  if (!account) {
    account = accountSelector.value
  } else {
    accountSelector.value = account
  }
  localStorage[global.db.username + '_lastSelected'] = accountSelector.selectedIndex
  refreshPublicKey()
  resetMenu()
}

function currentAccount () {
  return accountSelector.value
}

function refreshAccountSelector () {
  while (accountSelector.options.length) { accountSelector.remove(0) }

  const accountsList = global.db.listAccounts()
  const listWithNetwork = accountsList.map(account => {
    return [ global.db.network(account) + ': ' + account, account ]
  }).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))

  listWithNetwork.forEach(entry => {
    const accountNode = node.create('option', { value: entry[1] }, entry[0])
    node.append(accountSelector, accountNode)
  })

  let lastIndex = localStorage[global.db.username + '_lastSelected'] || 0
  if (lastIndex > accountsList.length - 1) lastIndex = accountsList.length - 1
  localStorage[global.db.username + '_lastSelected'] = lastIndex
  accountSelector.selectedIndex = lastIndex
}

async function refreshPublicKey () {
  const account = currentAccount()
  const publicKey = global.db.publicKey(account)
  if (!account) publicKeyNode.value = ''
  else publicKeyNode.value = publicKey

  const copiedNode = node.grab('#copied')
  if (copiedNode) node.destroy(copiedNode)

  handleQuery()
}

/** *************************** Settings ***************************************/

const settingsNode = node.grab('#settings')
const headerNode = node.grab('header')
const menuButtonNode = node.grab('#menuButton')
const messagesNode = node.grab('#messages')

export function showMenu () {
  node.append(headerNode, settingsNode)
  node.show(settingsNode)
  node.hide(mainNode)

  headerNode.style.minHeight = '100%'
  headerNode.style.position = 'absolute'
  menuButtonNode.onclick = hideMenu
  top()
}

function hideMenu () {
  node.hide(settingsNode)
  node.show(mainNode)

  headerNode.style.minHeight = null
  headerNode.style.position = 'fixed'
  menuButtonNode.onclick = showMenu
  resetMenu()
  top()
}

function resetMenu () {
  hideSecret()
}

export function showSetting (setting) {
  resetMenu()
  node.grab('.show', settingsNode).className = ''
  setting.className = 'show'
}

export function showSecret () {
  const account = currentAccount()
  const popup = passwordPopup(global.db.username,
    node.create('div', null,
      'Show secret seed for: ' + account,
      node.create('hr'),
      `Your secret seed offer full control over your account and should never be
      given away.`
    ))

  popup.addValidator(async password => {
    await popup.setInfo('Decrypting secret seed...')
    const seed = await global.db.secretSeed(password, account)
    const secretBox = node.grab('#secretSeed')
    secretBox.value = seed
    node.show(secretBox)
    const button = node.grab('#switchSecret')
    button.onclick = hideSecret
    button.value = 'Hide secret seed'
  })
}

function hideSecret () {
  const seedBox = node.grab('#secretSeed')
  seedBox.value = undefined
  node.hide(seedBox)
  const button = node.grab('#switchSecret')
  button.onclick = showSecret
  button.value = 'Show secret seed'
}

export function removeAccount () {
  const account = currentAccount()

  const popup = passwordPopup(global.db.username,
    node.create('div', null,
      'Remove account: ' + account,
      node.create('hr'),
      `You're about to remove this account from this device. Please make sure
      that you have an alternative way to access it, or that there's no more
      funds on it.`
    ))

  popup.addValidator(async password => {
    await popup.setInfo('Removing account...')
    await global.db.removeAccount(password, account)
    refreshPage()
  })
}

export function importSeed () {
  const popup = new Popup('Import account from seed')
  popup.addTextBox('name', 'Account name')
    .addTextBox('seed', 'Secret seed')
    .addCheckBox('testnet', 'On testnet', false)
    .addSeparator()
    .addPasswordConfirmation(global.db.username)
    .addValidator(async function () {
      const name = popup.inputs.name.value
      const password = popup.inputs.password.value
      const seed = popup.inputs.seed.value
      const network = popup.inputs.testnet.checked ? 'test' : 'public'

      await popup.setInfo('Importing account...')
      await global.db.addAccount(password, name, seed, network)
      refreshAccountSelector()
      selectAccount(name)
      hideMenu()
    })
}

export function newAccount () {
  const popup = new Popup('Create a new account')
  popup.addTextBox('name', 'Account name')
    .addCheckBox('testnet', 'On testnet', false)
    .addSeparator()
    .addPasswordConfirmation(global.db.username)
    .addValidator(async function () {
      const name = popup.inputs.name.value
      const password = popup.inputs.password.value
      const network = popup.inputs.testnet.checked ? 'test' : 'public'

      await popup.setInfo('Creating new account...')
      await global.db.newAccount(password, name, network)
      refreshAccountSelector()
      selectAccount(name)
      hideMenu()
    })
}

export function exportBackup () {
  const popup = passwordPopup(global.db.username, 'Make backup for: ' + global.db.username)
  popup.addValidator(async password => {
    await popup.setInfo('Checking password...')
    const backup = await global.db.backup(password)
    download(global.db.username + '.user', backup)
  })
}

export function passwordChange () {
  const popup = new Popup('Change password')
  popup.addAutofillPasswordBox(global.db.username)
    .addPasswordBox('password2', 'New password')
    .addPasswordBox('password3', 'Confirmation')
    .addCancelConfirmButtons()
    .addValidator(async function () {
      const password = popup.inputs.password.value
      const password2 = popup.inputs.password2.value
      const password3 = popup.inputs.password3.value

      if (password2 !== password3) throw new Error('New passwords mismatch')
      await popup.setInfo('Setting new password...')
      await global.db.changePassword(password, password2)
    })
}

export function removeUser (password) {
  const popup = passwordPopup(global.db.username,
    node.create('div', null,
      'Remove user: ' + global.db.username,
      node.create('hr'),
      `You're about to remove this profile and all associated accounts from
      this device. Please make sure that you have an alternative way to access
      them, or that there's no more funds on them.`
    ))

  popup.addValidator(async password => {
    await popup.setInfo('Deleting account...')
    await global.db.delete(password)
    logout()
  })
}

export function logout () {
  hideMenu()
  global.db.logout()
  global.db = undefined
  clearMessages()

  headerShowTitle()
  selectPage()
  footerShowDisclaimer()
  login()
}

/** ***************************** Page switching *******************************/

const titleNode = node.grab('#title')
const accountsNode = node.grab('#accounts')
const disclaimerNode = node.grab('#disclaimer')
const aboutLinkNode = node.grab('#aboutLink')

const aboutPage = node.grab('#about')

function top () { scroll(0, 0) }

export function selectPage (element) {
  const previousPage = currentPage()
  if (previousPage) mainNode.removeChild(previousPage)
  node.clear(notificationsNode)

  if (element) {
    node.show(mainNode)
    node.append(mainNode, element)
  } else node.hide(mainNode)

  top()
}

export function currentPage () {
  return node.grab('.page', mainNode)
}

function headerShowTitle () {
  node.hide(accountsNode)
  node.show(titleNode)
}

function headerShowAccounts () {
  node.hide(titleNode)
  node.show(accountsNode)
}

function showMessages () {
  node.show(messagesNode)
}

function hideMessages () {
  node.hide(messagesNode)
}

function clearMessages () {
  node.clear(passwordNode)
  node.clear(notificationsNode)
}

function footerShowDisclaimer () {
  node.hide(aboutLinkNode)
  node.show(disclaimerNode)
}

function footerShowAbout () {
  node.hide(disclaimerNode)
  node.show(aboutLinkNode)
}

function about () {
  headerShowTitle()
  hideMessages()
  selectPage(aboutPage)
  node.hide(aboutLinkNode)
}
