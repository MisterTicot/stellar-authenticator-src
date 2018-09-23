const ROOT = location.protocol + '//' + location.host + '/'
const VERSION = '0.1.28'
const CACHE_NAME = VERSION + ':cache'
const CACHE_FILES = [
  '/',
  'index.html',
  'authenticator.css',
  'authenticator.js',
  'cosmic-lib.css',
  'stellar-sdk.js'
]

self.addEventListener('install', function (event) {
  console.log('Installing service worker...')
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache => cache.addAll(CACHE_FILES))
    .then(self.skipWaiting())
    .then(console.log('Service worker installed'))
    .catch(console.error)
  )
})

self.addEventListener('activate', function (event) {
  console.log('Activating service worker...')
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => !key.startsWith(VERSION))
        .map(key => caches.delete(key))
    ))
      .then(console.log('Service worker activated'))
      .catch(console.error)
  )
})

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return

  let request = event.request
  const filename = event.request.url.replace(ROOT, '').replace(/\?.*$/, '')

  if (!filename || filename === 'index.html') {
    /// Strip out query string from request.
    request = new Request(ROOT + filename)
  } else if (CACHE_FILES.indexOf(filename) === -1) {
    /// The asset is not managed by the service worker.
    return
  }

  console.log('Fetching resource: ' + filename + '...')

  event.respondWith(
    caches.match(request)
      .then(function (cached) {
        const networked = fetch(request)
          .then(fetchedFromNetwork)
          .catch(console.error)
        return cached || networked

        function fetchedFromNetwork (response) {
          const cacheCopy = response.clone()
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, cacheCopy))
            .catch(console.error)
          return response
        }
      })
  )
})
