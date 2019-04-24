const dom = require("@cosmic-plus/domutils/es5/dom")
const Form = require("@cosmic-plus/domutils/es5/form")
const html = require("@cosmic-plus/domutils/es5/html")

dom.shadow = html.create("div", { id: "shadow", hidden: true })
dom.body.insertBefore(dom.shadow, dom.body.firstChild)

const Popup = module.exports = class Popup {
  constructor (title, noShadow) {
    return createPopup(title, noShadow)
  }
}

Popup.passwordPopup = function (
  username,
  title = "Please confirm this operation",
  message
) {
  const popup = new Popup(title)
  if (message) popup.addMessage(message).addSeparator()
  popup
    .putInfoNode()
    .addPasswordConfirmation(username)
    .addValidator(() => popup.inputs.password.value)
  return popup
}

function createPopup (title, noShadow) {
  const popup = new Form()
  popup.isPopup = true
  popup.window = html.create("div", ".popup", popup.node)
  popup
    .addNode("", html.create("h3", null, title))
    .addSeparator()
    .putInfoNode()
  html.append(dom.body, popup.window)

  if (!noShadow) popup.shadow = true

  popup.addCloseButton = function () {
    addCloseButton(popup)
    return popup
  }
  popup.addCancelConfirmButtons = function () {
    addCancelConfirmButtons(popup)
    return popup
  }
  popup.addPasswordConfirmation = function (username) {
    popup.addAutofillPasswordBox(username).addCancelConfirmButtons()
    return popup
  }

  popup.show = function () {
    showPopup(popup)
    return popup
  }
  popup.hide = function () {
    hidePopup(popup)
    return popup
  }
  popup.destroy = function () {
    destroyPopup(popup)
  }
  popup.onExit = popup.destroy

  popup.show(noShadow)
  return popup
}

function showPopup (popup) {
  html.show(popup.window)
  if (popup.shadow) {
    html.show(dom.shadow)
    dom.shadow.onclick = () => popup.onExit()
    html.appendClass(dom.header, "blur")
    html.appendClass(dom.main, "blur")
    dom.body.style.overflow = "hidden"
  }
  html.append(dom.body, popup.window)
}

function hidePopup (popup) {
  popup.onExit = function () {
    popup.hide()
    popup.reset()
  }
  if (popup.window.parentNode === dom.body) dom.body.removeChild(popup.window)
  dom.body.style.overflow = "auto"
  if (popup.shadow) {
    html.hide(dom.shadow)
    dom.header.classList.remove("blur")
    dom.main.classList.remove("blur")
  }
}

function destroyPopup (popup) {
  hidePopup(popup)
  html.destroy(popup.window)
}

function addCloseButton (popup) {
  popup.addSubmit("close")
  popup.inputs.submit.focus()
}

function addCancelConfirmButtons (popup) {
  popup
    .addButton("cancel", "✘ Cancel", popup.onExit)
    .addNode("", html.create("div", ".padding", " "))
    .addSubmit()
    .select()
}
