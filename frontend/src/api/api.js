import axios from 'axios'
import { storage } from '../utils/storage'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

// Track refresh attempts to prevent infinite loops
let isRefreshing = false
let failedQueue = []

// Request interceptor - attach token to requests
api.interceptors.request.use(
  config => {
    const token = storage.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

  // CSRF for cookie-auth endpoints
  const cookieAuthEndpoints = ['/auth/refresh', '/auth/logout']
  if (cookieAuthEndpoints.some(endpoint => config.url?.includes(endpoint))) {
    const csrf = storage.getRefreshCsrf()
    if (csrf) {
      config.headers['X-CSRF-REFRESH-TOKEN'] = csrf
    }
  }

  return config
}, error => Promise.reject(error))

// Response interceptor - handle token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    const errorCode = error.response?.data?.error?.code
    const isTokenExpired = errorCode === 'AUTH_TOKEN_EXPIRED'
    const hasAuthHeader = !!originalRequest.headers?.Authorization
    const isAuthEndpoint = originalRequest.url.includes('/auth/')
    const isLogout = originalRequest.url.includes('/auth/logout')

    // Only refresh when it's truly an expired token
    if (
      isTokenExpired &&
      hasAuthHeader &&
      !isAuthEndpoint &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Queue the request until refresh finishes
        const token = await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Attempt to refresh token
        const response = await api.post('/auth/refresh')
        const { access_token } = response.data
        storage.setAccessToken(access_token)

        // Update authorization header
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`
        originalRequest.headers.Authorization = `Bearer ${access_token}`

        // Process queued requests
        failedQueue.forEach(p => p.resolve(access_token))
        failedQueue = []

        isRefreshing = false
        return api(originalRequest)
      } catch (refreshError) {
        // Reject all queued requests
        failedQueue.forEach(p => p.reject(refreshError))
        failedQueue = []

        isRefreshing = false
        storage.clearAuth()
        window.location.href = '/login'

        return Promise.reject(refreshError)
      }
    }

    // Handle other auth errors
    if (
      (errorCode === 'AUTH_INVALID_TOKEN' || errorCode === 'AUTH_MISSING_TOKEN') &&
      !isLogout) {
        storage.clearAuth()
        window.location.href = '/login'
    }

    return Promise.reject(error)
  }
)