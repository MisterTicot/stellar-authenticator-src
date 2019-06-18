/// Service worker
const worker = navigator.serviceWorker
if (worker) {
  worker.register("worker.js")
  worker.addEventListener("controllerchange", () => location.reload())
}

module.exports = require("./UI")
