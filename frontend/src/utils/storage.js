const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_CSRF: 'refresh_csrf',
  EMAIL: 'email'
}

const setOrRemoveItem = (key, value) => {
  if (value) {
    localStorage.setItem(key, value)
  } else {
    localStorage.removeItem(key)
  }
}

export const storage = {
  // Access token
  getAccessToken: () => localStorage.getItem(KEYS.ACCESS_TOKEN),
  setAccessToken: (token) => {
    setOrRemoveItem(KEYS.ACCESS_TOKEN, token)
  },
  
  // CSRF token
  getRefreshCsrf: () => localStorage.getItem(KEYS.REFRESH_CSRF),
  setRefreshCsrf: (csrf) => {
    setOrRemoveItem(KEYS.REFRESH_CSRF, csrf)
  },
  
  // Email
  getEmail: () => localStorage.getItem(KEYS.EMAIL),
  setEmail: (email) => {
    setOrRemoveItem(KEYS.EMAIL, email)
  },
  
  // Clear all auth data
  clearAuth: () => {
    localStorage.removeItem(KEYS.ACCESS_TOKEN)
    localStorage.removeItem(KEYS.REFRESH_CSRF)
    localStorage.removeItem(KEYS.EMAIL)
  }
}