const cosmicLib = require('cosmic-lib')
const CosmicLink = cosmicLib.CosmicLink
const dom = require('@cosmic-plus/jsutils/dom')
const file = require('@cosmic-plus/jsutils/file')
const Form = require('@cosmic-plus/jsutils/form')
const html = require('@cosmic-plus/jsutils/html')

const crypto = require('./crypto')
const Database = require('./database')
const passwordPopup = require('./popup').passwordPopup
const Popup = require('./popup').Popup
const Notification = require('./notifications')

/** Global variables **/

const global = {
  cosmicLink: null,
  db: null,
  signers: null,
  history: history.length
}

dom.transaction = dom.CL_htmlNode

/** helpers ***/
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

/** Install button **/
let deferredPrompt

window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault()
  deferredPrompt = event
  html.show(dom.installApp)
})

dom.installApp.addEventListener('click', function (event) {
  html.hide(dom.installApp)
  deferredPrompt.prompt()
  deferredPrompt = undefined
})

/** ************************* Login in *****************************************/

export async function init () {
  global.db = await Database.current()
  if (localStorage.accounts && !localStorage.upgraded) {
    upgrade()
  } else if (global.db) open()
  else if (localStorage.length) login()
  else selectPage(dom.welcome)
}

function login () {
  const selectNode = makeUserSelector()

  if (selectNode.length === 0) {
    selectPage(dom.welcome)
    return
  }

  /// Fix password autofill
  selectNode.onchange = () => {
    usernameNode.value = selectNode.value
    const passwordNode = popup.inputs.password
    passwordNode.name = ''
    const newNode = html.create('input', {
      name: 'password',
      type: 'password',
      placeholder: 'Authenticator password'
    })
    popup.html.appendinsertBefore(newNode, passwordNode)
    popup.inputs.password = newNode
    html.appenddestroy(passwordNode)
  }

  const last = localStorage.lastSelectedUser
  if (last) selectNode.selectedIndex = last

  const popup = new Popup('Please enter your password to start', true)
  const inputs = popup.inputs
  const usernameNode = html.create('input', {
    readonly: true,
    value: selectNode.value,
    name: 'username'
  })
  html.hide(usernameNode)

  popup.addNode('usernameSelector', selectNode)
    .addNode('', usernameNode)
    .addPasswordBox('password')
    .addSubmit('Open')
    .addSeparator()
    .addNode('', html.create('a', { onclick: () => newUser(popup) }, 'New User'))
    .addNode('', ' | ')
    .addNode('', html.create('a', { onclick: () => importUser(popup) }, 'Import User'))
    .addNode('', ' | ')
    .addNode('', html.create('a', { onclick: () => guestMode(popup) }, 'Guest Mode'))
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
  const selectNode = html.create('select')
  const usernames = Database.listUsers()
  usernames.forEach(user => {
    html.append(selectNode, html.create('option', { value: user }, user))
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
      const encrypted = await file.load(popup.inputs.file.files[0])
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

const loginOptions = new Form(dom.loginOptions)

export async function guestMode (form = loginOptions) {
  await form.setInfo('Opening guest session...')
  const password = crypto.makeSalt(3)
  sessionStorage.password = password
  global.db = await Database.new('guest', password)
  await global.db.newAccount(password, 'Guest', 'test')
  if (form.isPopup) form.destroy()
  else form.reset()
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
  refreshPage()

  /// Show guest mode password
  if (sessionStorage.password) dom.password.textContent = 'Password: ' + sessionStorage.password
}

function handleQuery () {
  if (location.search === '?about') {
    about()
    return
  }

  headerShowAccounts()
  refreshAccountSelector()
  refreshPublicKey()
  showMessages()
  footerShowAbout()

  if (location.search.length > 1) {
    resetReadTransactionPage()
    selectPage(dom.readTransaction)
    parseQuery(location.search)
  } else {
    selectPage(dom.openTransaction)
  }
}

/** **************************** Open transaction ******************************/

const openUriForm = new Form(dom.openUri)
  .addValidator(() => {
    const uri = openUriForm.inputs.uri.value
    const query = uri.replace(/^[^?]*/, '')
    if (query < 2) throw new Error('Not a transaction link')
    pushQuery(query)
    openUriForm.reset()
  })

const openXdrForm = new Form(dom.openXdr)
  .addValidator(() => {
    try {
      const inputs = openXdrForm.inputs
      const xdr = inputs.xdr.value
      new StellarSdk.Transaction(xdr)
      let query = '?xdr=' + xdr
      if (inputs.stripSource.checked) query += '&stripSource'
      else if (inputs.stripSequence.checked) query += '&stripSequence'
      else if (inputs.stripSignatures.checked) query += '&stripSignatures'
      pushQuery(query)
      openXdrForm.reset()
    } catch (error) {
      console.log(error)
      throw new Error('Invalid XDR')
    }
  })

export function openXdrOption (element) {
  if (element.checked) {
    dom.xdrStripSource.checked = false
    dom.xdrStripSequence.checked = false
    dom.xdrStripSignatures.checked = false
    element.checked = true
  }
}

/** ***************************** Read transaction *****************************/

async function parseQuery (query) {
  const account = currentAccount()
  const network = account && global.db.network(account)
  const publicKey = account && global.db.publicKey(account)

  global.cosmicLink = new CosmicLink(query, { network: network, user: publicKey })
  global.cosmicLink.addAliases(global.db.aliases)
  if (!account) return

  /// Check if account exists.
  const loadingMsg = new Notification('loading', 'Loading account...')
  let exist = await accountExist(publicKey, network)
  loadingMsg.destroy()
  if (currentAccount() !== account) return

  /// Fund empty test accounts.
  if (!exist) {
    if (network === 'test') {
      await fundTestAccount(publicKey)
      parseQuery(query)
      return
    }
  }

  /// Find legit signers
  let tdesc, signers
  try {
    tdesc = await global.cosmicLink.getTdesc()
    signers = await global.cosmicLink.getSigners()
  } catch (error) {
    console.log(error)
    return
  }
  global.signers = []
  if (tdesc.source) {
    for (let index in dom.accountSelector.childNodes) {
      const accountNode = dom.accountSelector.childNodes[index]
      const accountName = accountNode.value
      const source = await global.cosmicLink.getSource()
      if (!accountName) continue
      const publicKey = global.db.publicKey(accountName)
      if (signers.find(entry => entry.value === publicKey)) {
        if (publicKey === source) global.signers.unshift(accountName)
        else global.signers.push(accountName)
      } else {
        accountNode.disabled = true
      }
    }

    if (global.signers.length === 0) {
      dom.accountSelector.selectedIndex = -1
      refreshPublicKey()
      new Notification('warning', 'No signer for this transaction',
        "There's no legit signer for this transaction among your accounts."
      )
      return
    }

    if (!global.signers.find(entry => entry === account)) {
      dom.accountSelector.value = global.signers[0]
      refreshPublicKey()
    }
  } else {
    signers.forEach(signer => {
      const accountName = global.db.accountName(signer.value, network)
      if (accountName) global.signers.push(accountName)
    })
  }

  try {
    await global.cosmicLink.getXdr()
    if (global.signers.length) dom.signingButton.disabled = false
  } catch (error) {
    console.log(error)
  }
}

cosmicLib.defaults.addFormatHandler('xdr', event => {
  if (event.cosmicLink !== global.cosmicLink) return
  if (event.value) xdrBox.value = event.value
  else xdrBox.placeholder = event.error.message
})

cosmicLib.defaults.addFormatHandler('uri', event => {
  if (event.cosmicLink !== global.cosmicLink) return
  if (event.value) uriBox.value = event.value
  else uriBox.placeholder = event.error.message
})

cosmicLib.defaults.addFormatHandler('query', event => {
  if (event.cosmicLink !== global.cosmicLink) return
  if (event.value) history.replaceState(null, '', event.value)
  else console.log(event.error)
})

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

const uriViewerForm = new Form(dom.uriViewer)
const uriBox = uriViewerForm.inputs.uri
const xdrViewerForm = new Form(dom.xdrViewer)
const xdrBox = xdrViewerForm.inputs.xdr
dom.signingButton.disabled = true

export function signAndSend () {
  const popup = passwordPopup(global.db.username, 'Sign & send')
  popup.addValidator(async password => {
    await popup.setInfo('Signing transaction...')

    const keypairs = await global.db.keypair(password, ...global.signers)
    if (global.signers.length === 1) await global.cosmicLink.sign(keypairs)
    else await global.cosmicLink.sign(...keypairs)

    dom.signingButton.disabled = true

    popup.destroy()

    top()
    const message2 = new Notification('loading', 'Sending transaction...')
    try {
      const response = await global.cosmicLink.send()
      if (!response.stellarGuard) new Notification('done', 'Transaction validated')
      else new Notification('done', 'Transaction submitted to Stellar Guard')
    } catch (error) {
      console.log(error)
      new Notification('warning', 'Transaction rejected', error)
    }
    message2.destroy()
  })
}

export function closeTransaction () {
  delete global.cosmicLink
  popQuery()
}

function resetReadTransactionPage () {
  html.clear(dom.transaction)
  uriViewerForm.reset()
  xdrViewerForm.reset()
  xdrBox.placeholder = 'Computing...'
  dom.signingButton.disabled = true
}

/** ****************************** History *************************************/

export function pushQuery (query) {
  history.pushState(null, '', query)
  handleQuery()
}

export function popQuery () {
  if (
    global.history === history.length &&
    !document.referrer
  ) {
    history.replaceState(null, '', '?')
    handleQuery()
  } else {
    history.back()
  }
}

window.onpopstate = function () {
  if (global.db) handleQuery()
}

/** ********************* Header & account selection ***************************/

function refreshPage () {
  refreshAccountSelector()
  refreshPublicKey()
  handleQuery()
}

export function selectAccount (account) {
  if (!account) {
    account = dom.accountSelector.value
  } else {
    dom.accountSelector.value = account
  }
  localStorage[global.db.username + '_lastSelected'] = dom.accountSelector.selectedIndex
  refreshPublicKey()
  handleQuery()
  resetMenu()
}

function currentAccount () {
  return dom.accountSelector.value
}

function refreshAccountSelector () {
  while (dom.accountSelector.options.length) { dom.accountSelector.remove(0) }

  const accountsList = global.db.listAccounts()
  const listWithNetwork = accountsList.map(account => {
    return [ global.db.network(account) + ': ' + account, account ]
  }).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()))

  listWithNetwork.forEach(entry => {
    const accountNode = html.create('option', { value: entry[1] }, entry[0])
    html.append(dom.accountSelector, accountNode)
  })

  let lastIndex = localStorage[global.db.username + '_lastSelected'] || 0
  if (lastIndex > accountsList.length - 1) lastIndex = accountsList.length - 1
  localStorage[global.db.username + '_lastSelected'] = lastIndex
  dom.accountSelector.selectedIndex = lastIndex
}

async function refreshPublicKey () {
  const account = currentAccount()
  if (account) dom.publicKey.value = global.db.publicKey(account)
  else dom.publicKey.value = null

  const copiedNode = html.grab('#copied')
  if (copiedNode) html.appenddestroy(copiedNode)
}

/** *************************** Copy field *************************************/

export async function copyContent (element) {
  if (html.appendcopyContent(element) && document.activeElement.value) {
    const prevNode = html.grab('#copied')
    if (prevNode) html.appenddestroy(prevNode)
    const copiedNode = html.create('div', '#copied', 'Copied')
    element.parentNode.insertBefore(copiedNode, element.nextSibling)
    setTimeout(() => { copiedNode.style.opacity = 0 }, 3000)
  }
}

/** *************************** Settings ***************************************/

export function showMenu () {
  html.append(dom.header, dom.settings)
  html.show(dom.settings)
  html.hide(dom.main)

  dom.header.style.minHeight = '100%'
  dom.header.style.position = 'absolute'
  dom.menuButton.onclick = hideMenu
  top()
}

function hideMenu () {
  html.hide(dom.settings)
  html.show(dom.main)

  dom.header.style.minHeight = null
  dom.header.style.position = 'fixed'
  dom.menuButton.onclick = showMenu
  resetMenu()
  top()
}

function resetMenu () {
  hideSecret()
}

export function showSetting (setting) {
  resetMenu()
  html.grab('.show', dom.settings).className = ''
  setting.className = 'show'
}

export function showSecret () {
  const account = currentAccount()
  if (!account) return
  const popup = passwordPopup(global.db.username,
    'Show secret seed for: ' + account,
    'Your secret seed offer full control over your account and should never be given away.'
  )

  popup.addValidator(async password => {
    await popup.setInfo('Decrypting secret seed...')
    const seed = await global.db.secretSeed(password, account)
    dom.secretSeed.value = seed
    html.show(dom.secretSeed)
    dom.switchSecret.onclick = hideSecret
    dom.switchSecret.value = 'Hide secret seed'
  })
}

function hideSecret () {
  dom.secretSeed.value = undefined
  html.hide(dom.secretSeed)
  dom.switchSecret.onclick = showSecret
  dom.switchSecret.value = 'Show secret seed'
}

export function removeAccount () {
  const account = currentAccount()
  if (!account) return

  const popup = passwordPopup(global.db.username,
    'Remove account: ' + account,
    `You're about to remove this account from this device. Please make sure
    that you have an alternative way to access it, or that there's no more
    funds on it.`
  )

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
    file.save(global.db.username + '.user', backup)
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

      /// Delete guest mode default password
      if (sessionStorage.password) {
        delete sessionStorage.password
        dom.password.textContent = ''
      }
    })

  /// Prevent those box to be filled in by current password in guest mode.
  popup.inputs.password2.value = ''
  popup.inputs.password3.value = ''
}

export function removeUser (password) {
  const popup = passwordPopup(global.db.username,
    'Remove user: ' + global.db.username,
    `You're about to remove this profile and all associated accounts from
    this device. Please make sure that you have an alternative way to access
    them, or that there's no more funds on them.`
  )

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

function top () { scroll(0, 0) }

export function selectPage (element) {
  const previousPage = currentPage()
  if (previousPage) dom.main.removeChild(previousPage)
  html.clear(dom.notifications)

  if (element) {
    html.show(dom.main)
    html.append(dom.main, element)
  } else {
    html.hide(dom.main)
  }

  top()
}

export function currentPage () {
  return html.grab('.page', dom.main)
}

function headerShowTitle () {
  html.hide(dom.accounts)
  html.show(dom.title)
}

function headerShowAccounts () {
  html.hide(dom.title)
  html.show(dom.accounts)
}

function showMessages () {
  html.show(dom.messages)
}

function hideMessages () {
  html.hide(dom.messages)
}

function clearMessages () {
  html.clear(dom.password)
  html.clear(dom.notifications)
}

function footerShowDisclaimer () {
  html.hide(dom.social)
  html.show(dom.disclaimer)
}

const openAboutPage = () => { pushQuery('?about') }
function footerShowAbout () {
  html.hide(dom.disclaimer)
  html.show(dom.social)
  dom.aboutIcon.onclick = openAboutPage
}

function about () {
  headerShowTitle()
  hideMessages()
  selectPage(dom.about)
  dom.aboutIcon.onclick = null
}
