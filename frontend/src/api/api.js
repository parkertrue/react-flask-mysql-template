import axios from 'axios'
import { storage } from '../utils/storage'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

// Endpoints authenticated by the refresh cookie, which the backend protects
// with a double-submit CSRF header. '/auth/logout' also covers '/auth/logout-all'.
const REFRESH_COOKIE_ENDPOINTS = ['/auth/refresh', '/auth/logout']

// Only one refresh may be in flight; requests that expire meanwhile wait in
// the queue and retry with the token it produces.
let isRefreshing = false
let failedQueue = []

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
}, error => Promise.reject(error))

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
        const response = await api.post('/auth/refresh')
        const { access_token, refresh_csrf } = response.data
        storage.setAccessToken(access_token)
        // Every refresh token carries its own CSRF value. Keeping the old one
        // makes the next refresh, and logout, fail the backend's CSRF check.
        storage.setRefreshCsrf(refresh_csrf)

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
        if (refreshError.response?.status === 401) {
          storage.clearAuth()
          window.location.href = '/login'
        }

        return Promise.reject(refreshError)
      }
    }

    if (
      (errorCode === 'AUTH_INVALID_TOKEN' || errorCode === 'AUTH_MISSING_TOKEN') &&
      !url.startsWith('/auth/logout')
    ) {
      storage.clearAuth()
      window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)
