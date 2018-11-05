/**
 * With this service worker, the whole application is installed in cache each
 * time an update is available and run from there.
 */

const hostname = location.host.replace(/:.*/,"")
const ENABLED = hostname !== "localhost" && hostname !== "127.0.0.1"
const PACKAGE = require("../package.json").name
const VERSION = require("../package.json").version
const ROOT = `${location.protocol}//${location.host}/`
const TIMEOUT = 1000
const CACHE_NAME = `${PACKAGE}-${VERSION}`
const CACHE_FILES = [
  "/",
  "authenticator.css",
  "authenticator.js",
  "cosmic-lib.css",
  "index.html",
  "stellar-sdk.js"
]

self.addEventListener("install", function (event) {
  console.log(`Installing ${CACHE_NAME}...`)
  event.waitUntil(precache(CACHE_FILES)
    .then(() => self.skipWaiting())
    .then(() => console.log(`${CACHE_NAME} installed`))
  )
})

self.addEventListener("activate", function (event) {
  event.waitUntil(cleanCache())
})

self.addEventListener("fetch", function (event) {
  if (!ENABLED || event.request.method !== "GET") return
  if (!event.request.url.match(startByRoot)) return

  /// Strip out query string from request.
  const request = new Request(event.request.url.replace(/\?.*$/, ""))
  const filename = request.url.replace(startByRoot, "") || "index.html"

  event.respondWith(
    fromCache(request).then(cached => {
      if (cached) {
        console.log(`Loading ${filename} for ${CACHE_NAME}...`)
        return cached
      } else {
        console.log(`Downloading ${filename}...`)
        return fromNetwork(request)
      }
    })
  )
})

const startByRoot = new RegExp("^" + ROOT)

/**
 * Cache `files` into `cacheName`, then return.
 */
function precache (files) {
  return caches.open(CACHE_NAME).then(cache => cache.addAll(files))
}

/**
 * Wipe every caches except **CACHE_NAME**.
 */
function cleanCache () {
  return caches.keys().then(function (keys) {
    return Promise.all(
      keys.map(key => { if (key !== CACHE_NAME) caches.delete(key) })
    )
  })
}

/**
 * Fetch `request` from network or reject after `timeout`.
 */
function fromNetwork (request) {
  return new Promise(function (resolve, reject) {
    const timeoutId = setTimeout(reject, TIMEOUT)

    return fetch(request).then(function (response) {
      clearTimeout(timeoutId)
      resolve(response)
    })
  })
}

/**
 * Cache `response` to `request`.
 */
function cacheResponse (request, response) {
  const cacheCopy = response.clone()
  caches.open(CACHE_NAME).then(cache => cache.put(request, cacheCopy))
}

/**
 * Fetch `request` from cache or reject.
 */
function fromCache (request) {
  return caches.open(CACHE_NAME).then(cache => cache.match(request))
}
