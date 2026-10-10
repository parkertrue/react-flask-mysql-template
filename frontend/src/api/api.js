import axios from 'axios'
import { storage } from '@/auth/storage'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true
})

// Endpoints authenticated by the refresh cookie, which the backend protects
// with a double-submit CSRF header. '/auth/logout' also covers '/auth/logout-all'.
const REFRESH_COOKIE_ENDPOINTS = ['/auth/refresh', '/auth/logout']

// Only one refresh may be in flight; requests that expire meanwhile wait in
// the queue and retry with the token it produces.
let isRefreshing = false
let failedQueue = []

// Tabs share the refresh cookie, and each refresh revokes the token it
// used, so two tabs refreshing at once would sign the slower one out. A Web
// Lock makes tabs take turns; one that waited finds the access token the
// other stored (localStorage is shared too) and uses it instead of
// refreshing again. Browsers without the API (or a non-HTTPS origin other
// than localhost) refresh without the lock.
async function refreshTokens(staleToken) {
  const refresh = async () => {
    const current = storage.getAccessToken()
    if (current && current !== staleToken) {
      return current
    }

    const response = await api.post('/auth/refresh')
    const { access_token, refresh_csrf } = response.data
    storage.setAccessToken(access_token)
    // Every refresh token carries its own CSRF value. Keeping the old one
    // makes the next refresh, and logout, fail the backend's CSRF check.
    storage.setRefreshCsrf(refresh_csrf)
    return access_token
  }

  return navigator.locks
    ? navigator.locks.request('auth-refresh', refresh)
    : refresh()
}

api.interceptors.request.use(config => {
  const token = storage.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (REFRESH_COOKIE_ENDPOINTS.some(endpoint => config.url?.startsWith(endpoint))) {
    const csrf = storage.getRefreshCsrf()
    if (csrf) {
      config.headers['X-CSRF-REFRESH-TOKEN'] = csrf
    }
  }

  return config
})

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    if (!originalRequest) {
      return Promise.reject(error)
    }

    const errorCode = error.response?.data?.error?.code
    const url = originalRequest.url || ''

    // Only refresh when an authenticated request failed on an expired token
    if (
      errorCode === 'AUTH_TOKEN_EXPIRED' &&
      originalRequest.headers?.Authorization &&
      !url.startsWith('/auth/') &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        const token = await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const staleToken = originalRequest.headers.Authorization.replace(/^Bearer /, '')
        const access_token = await refreshTokens(staleToken)

        originalRequest.headers.Authorization = `Bearer ${access_token}`

        failedQueue.forEach(p => p.resolve(access_token))
        failedQueue = []
        isRefreshing = false

        return api(originalRequest)
      } catch (refreshError) {
        failedQueue.forEach(p => p.reject(refreshError))
        failedQueue = []
        isRefreshing = false

        // Only a 401 means the session is over. A 429, a 503 or a network
        // error is temporary: keep the session, fail just these requests with
        // the refresh's own message, and let the next request try again.
        // Clearing storage ends the session everywhere: AuthProvider re-renders
        // and ProtectedRoute sends the user to log in, without a page reload.
        if (refreshError.response?.status === 401) {
          storage.clearAuth()
        }

        return Promise.reject(refreshError)
      }
    }

    if (
      (errorCode === 'AUTH_INVALID_TOKEN' || errorCode === 'AUTH_MISSING_TOKEN') &&
      !url.startsWith('/auth/logout')
    ) {
      storage.clearAuth()
    }

    return Promise.reject(error)
  }
)
