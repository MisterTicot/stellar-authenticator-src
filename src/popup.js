import {Form} from './form'
import * as node from '@cosmic-plus/jsutils/html'

const bodyNode = node.grab('body')
const mainNode = node.grab('main')
const headerNode = node.grab('header')

const shadowNode = node.create('div', '#shadow')
bodyNode.insertBefore(shadowNode, bodyNode.firstChild)

export function passwordPopup (username, title = 'Please confirm this operation', message) {
  const popup = new Popup(title)
  if (message) popup.addMessage(message).addSeparator()
  popup.putInfoNode()
    .addPasswordConfirmation(username)
    .addValidator(() => popup.inputs.password.value)
  return popup
}

export class Popup {
  constructor (title, noShadow) { return createPopup(title, noShadow) }
}

function createPopup (title, noShadow) {
  const popup = new Form()
  popup.isPopup = true
  popup.window = node.create('div', '.popup', popup.node)
  popup.addNode('', node.create('h3', null, title)).addSeparator().putInfoNode()
  node.append(bodyNode, popup.window)

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
  node.show(popup.window)
  if (popup.shadow) {
    shadowNode.style.display = 'block'
    shadowNode.onclick = () => popup.onExit()
    node.appendClass(headerNode, 'blur')
    node.appendClass(mainNode, 'blur')
    bodyNode.style.overflow = 'hidden'
  }
  node.append(bodyNode, popup.window)
}

function hidePopup (popup) {
  popup.onExit = function () { popup.hide(); popup.reset() }
  if (popup.window.parentNode === bodyNode) bodyNode.removeChild(popup.window)
  bodyNode.style.overflow = 'auto'
  if (popup.shadow) {
    node.hide(shadowNode)
    headerNode.classList.remove('blur')
    mainNode.classList.remove('blur')
  }
}

function destroyPopup (popup) {
  hidePopup(popup)
  node.destroy(popup.window)
}

function addCloseButton (popup) {
  popup.addSubmit('close')
  popup.inputs.submit.focus()
}

function addCancelConfirmButtons (popup) {
  popup.addButton('cancel', '✘ Cancel', popup.onExit)
    .addNode('', node.create('div', '.padding', ' '))
    .addSubmit().select()
}
