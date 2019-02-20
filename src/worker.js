"use_strict"

const ServiceWorker = require("@cosmic-plus/jsutils/service-worker")
const pkg = require("../package.json")

new ServiceWorker(pkg.name, pkg.version, "verbose")
  .fromCache([
    // Application
    "/",
    "cosmic-lib.css",
    "index.css",
    "index.html",
    "index.js",
    "stellar-sdk.js",

    // Vendor configuration
    "browserconfig.xml",
    "manifest.json",

    // Icons
    "icons/16x16.png",
    "icons/32x32.png",
    "icons/192x192.png",
    "icons/512x512.png",
    "icons/apple-touch.png",
    "icons/mstile.png",
    "icons/safari.svg"
  ])
  .precache()
  .register()
