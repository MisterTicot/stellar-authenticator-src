const ROOT = location.protocol + '//' + location.host + '/'
const VERSION = '0.1.26'
const CACHE_NAME = VERSION + ':cache'
const CACHE_FILES = [
  '/',
  'index.html',
  'authenticator.css',
  'authenticator.js',
  'bower-js-stellar-sdk/stellar-sdk.min.js'
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
  const filename = event.request.url.replace(ROOT, '').replace(/\?.*$/, '')
  if (filename && CACHE_FILES.indexOf(filename) === -1) return

  console.log('Fetching resource: ' + filename + '...')

  event.respondWith(
    caches.match(event.request)
      .then(function (cached) {
        const networked = fetch(event.request)
          .then(fetchedFromNetwork)
          .catch(console.error)
        return cached || networked

        function fetchedFromNetwork (response) {
          const cacheCopy = response.clone()
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, cacheCopy))
            .catch(console.error)
          return response
        }
      })
  )
})
