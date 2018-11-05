/// Service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("worker.js")
}

module.exports = require("./UI")
