import * as UI from './UI'
import {copyContent} from '@cosmic-plus/jsutils/misc'

module.exports = UI
module.exports.copyContent = copyContent

/// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('worker.js').catch(console.error)
}
