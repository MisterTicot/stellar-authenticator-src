"use_strict"

const ServiceWorker = require("@cosmic-plus/jsutils/service-worker")
const pkg = require("../package.json")

new ServiceWorker(pkg.name, pkg.version, "verbose")
  .fromCache([
    "/",
    "authenticator.css",
    "authenticator.js",
    "cosmic-lib.css",
    "index.html",
    "stellar-sdk.js"
  ])
  .precache()
  .register()
