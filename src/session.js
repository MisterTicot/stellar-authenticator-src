/**
 * This event listener keeps the encrypted database consistent over multiple
 * browser tabs.
 */

/// Request data from other tabs.
if (!sessionStorage.length) localStorage.getSessionStorage = Date.now()
delete localStorage.getSessionStorage

window.addEventListener('storage', function (event) {
  /// No new value = no message.
  if (!event.newValue) return

  if (
    event.key === 'getSessionStorage' &&
    sessionStorage.length &&
    !localStorage.sessionStorage
  ) {
    /// Send opening key for non-sensitive data to other tabs.
    localStorage.sessionStorage = JSON.stringify(sessionStorage)
    delete localStorage.sessionStorage
  } else if (event.key === 'sessionStorage' && !sessionStorage.length) {
    /// Get opening key for non-sensitive data from other tab.
    const data = JSON.parse(event.newValue)
    sessionStorage.username = data.username
    sessionStorage.userkey = data.userkey
    if (data.password) sessionStorage.password = data.password
  } else if (!document.hasFocus() && (event.key.substr(-9) === '_database' || event.key === 'logout')) {
    /// Logout / refresh database on all tabs.
    sessionStorage.clear()
    location.reload()
  } else if (!document.hasFocus() && event.key === 'login' && !sessionStorage.length) {
    /// Login on all tabs.
    location.reload()
  }
})
