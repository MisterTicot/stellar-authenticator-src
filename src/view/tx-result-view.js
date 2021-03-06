"use strict"
/**
 * TxResultView - Displays TxResult instances
 */
const Gui = require("@cosmic-plus/domutils/es5/gui")
const html = require("@cosmic-plus/domutils/es5/html")

const TxResult = require("@cosmic-plus/tx-result")

/* Definition */
class TxResultView extends Gui {
  static async forCosmicLink (cosmicLink) {
    const result = await TxResult.forCosmicLink(cosmicLink)
    return new TxResultView(result)
  }

  static fromResponse (response) {
    const result = new TxResult(response)
    return new TxResultView(result)
  }

  constructor (txResult) {
    super(`
<div class=%state>
  <h3>%title</h3>

  <ul hidden=%hideErrors>
    %{toLi:errors...}
  </ul>
</div>
    `)

    Object.assign(this, txResult)
    this.state = this.validated ? "done" : "warning"
    this.hideErrors = this.validated || !this.errors.length
  }

  toLi (msg) {
    return html.create("li", null, msg)
  }
}

/* Exports */
module.exports = TxResultView
