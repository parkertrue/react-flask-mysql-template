const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_CSRF: 'refresh_csrf',
  EMAIL: 'email'
}

const listeners = new Set()
const notify = () => listeners.forEach(listener => listener())

const setOrRemoveItem = (key, value) => {
  if (value) {
    localStorage.setItem(key, value)
  } else {
    localStorage.removeItem(key)
  }
  notify()
}

// Access tokens are stored in localStorage (XSS-accessible). This is an accepted
// risk mitigated by: short 15-min expiry, HttpOnly refresh cookie, CSP headers,
// and React's output escaping. The refresh token itself is HttpOnly-only.
export const storage = {
  getAccessToken: () => localStorage.getItem(KEYS.ACCESS_TOKEN),
  setAccessToken: (token) => setOrRemoveItem(KEYS.ACCESS_TOKEN, token),

  getRefreshCsrf: () => localStorage.getItem(KEYS.REFRESH_CSRF),
  setRefreshCsrf: (csrf) => setOrRemoveItem(KEYS.REFRESH_CSRF, csrf),

  getEmail: () => localStorage.getItem(KEYS.EMAIL),
  setEmail: (email) => setOrRemoveItem(KEYS.EMAIL, email),

  clearAuth: () => {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key))
    notify()
  },

  // For useSyncExternalStore: calls the listener whenever the session changes,
  // here or in another tab (the browser's storage event covers those)
  subscribe: (listener) => {
    listeners.add(listener)
    window.addEventListener('storage', listener)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', listener)
    }
  }
}
