const dom = require("@cosmic-plus/domutils/es5/dom")
const html = require("@cosmic-plus/domutils/es5/html")
const helpers = require("@cosmic-plus/jsutils/es5/misc")

module.exports = class Notification {
  constructor (type, title, message, delay) {
    this.node = html.create("div", "." + type)
    if (type === "loading") {
      html.append(this.node, html.create("span", ".cosmiclib_loadingAnim"))
    }
    html.append(this.node, html.create("h3", null, title))
    html.append(dom.notifications, this.node)

    if (message) html.append(this.node, message)
    if (delay) helpers.timeout(delay).then(() => this.destroy())
  }

  show () {
    this.hidden = false
  }
  hide () {
    this.hidden = true
  }
  destroy () {
    html.destroy(this.node)
  }
}
