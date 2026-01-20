import { api } from '../api'

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