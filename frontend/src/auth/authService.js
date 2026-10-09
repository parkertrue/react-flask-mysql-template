import { api } from '@/api/api'

export async function registerUser(email, password) {
  const response = await api.post('/auth/register', { email, password })
  return response.data
}

export async function loginUser(email, password) {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

export async function logoutUser() {
  await api.post('/auth/logout')
}

export async function logoutAllDevices() {
  await api.post('/auth/logout-all')
}

// The JSON body is required: it stops other sites calling this without CORS
export async function clearAuthCookies() {
  await api.post('/auth/clear-cookies', {})
}