const popup = exports

const dom = require('@cosmic-plus/jsutils/dom')
const Form = require('@cosmic-plus/jsutils/form')
const html = require('@cosmic-plus/jsutils/html')

dom.shadow = html.create('div', '#shadow')
dom.body.insertBefore(dom.shadow, dom.body.firstChild)

popup.passwordPopup = function (username, title = 'Please confirm this operation', message) {
  const popup = new Popup(title)
  if (message) popup.addMessage(message).addSeparator()
  popup.putInfoNode()
    .addPasswordConfirmation(username)
    .addValidator(() => popup.inputs.password.value)
  return popup
}

popup.Popup = class Popup {
  constructor (title, noShadow) { return createPopup(title, noShadow) }
}

function createPopup (title, noShadow) {
  const popup = new Form()
  popup.isPopup = true
  popup.window = html.create('div', '.popup', popup.node)
  popup.addNode('', html.create('h3', null, title)).addSeparator().putInfoNode()
  html.append(dom.body, popup.window)

  if (!noShadow) popup.shadow = true

  popup.addCloseButton = function () { addCloseButton(popup); return popup }
  popup.addCancelConfirmButtons = function () { addCancelConfirmButtons(popup); return popup }
  popup.addPasswordConfirmation = function (username) {
    popup.addAutofillPasswordBox(username).addCancelConfirmButtons()
    return popup
  }

  popup.show = function (noShadow) { showPopup(popup, noShadow); return popup }
  popup.hide = function () { hidePopup(popup); return popup }
  popup.destroy = function () { destroyPopup(popup) }
  popup.onExit = popup.destroy

  popup.show(noShadow)
  return popup
}

function showPopup (popup, noShadow) {
  html.show(popup.window)
  if (popup.shadow) {
    dom.shadow.style.display = 'block'
    dom.shadow.onclick = () => popup.onExit()
    html.appendClass(dom.header, 'blur')
    html.appendClass(dom.main, 'blur')
    dom.body.style.overflow = 'hidden'
  }
  html.append(dom.body, popup.window)
}

function hidePopup (popup) {
  popup.onExit = function () { popup.hide(); popup.reset() }
  if (popup.window.parentNode === dom.body) dom.body.removeChild(popup.window)
  dom.body.style.overflow = 'auto'
  if (popup.shadow) {
    html.hide(dom.shadow)
    dom.header.classList.remove('blur')
    dom.main.classList.remove('blur')
  }
}

function destroyPopup (popup) {
  hidePopup(popup)
  html.destroy(popup.window)
}

function addCloseButton (popup) {
  popup.addSubmit('close')
  popup.inputs.submit.focus()
}

function addCancelConfirmButtons (popup) {
  popup.addButton('cancel', '✘ Cancel', popup.onExit)
    .addNode('', html.create('div', '.padding', ' '))
    .addSubmit().select()
}
