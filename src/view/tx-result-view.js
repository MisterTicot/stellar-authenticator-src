"use strict"
/**
 * TxResultView - Displays TxResult instances
 */
const Gui = require("@cosmic-plus/domutils/es5/gui")
const html = require("@cosmic-plus/domutils/es5/html")

const TxResult = require("@cosmic-plus/tx-result")

/* Definition */
class TxResultView extends Gui {
  static fromResponse (response) {
    const result = new TxResult(response)
    return new TxResultView(result)
  }

  constructor (txResult) {
    super(`
<div class=%state>
  <h3>%title</h3>

  <ul hidden=%validated>
    %{toLi:errors...}
  </ul>
</div>
    `)

    Object.assign(this, txResult)
    this.state = this.validated ? "done" : "warning"
  }

  toLi (msg) {
    return html.create("li", null, msg)
  }
}

/* Exports */
module.exports = TxResultView
