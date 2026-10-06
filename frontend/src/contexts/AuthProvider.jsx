import { useState } from 'react'
import { storage } from '../utils/storage'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storage.getAccessToken())
  const [email, setEmail] = useState(() => storage.getEmail())
  
  const isAuthenticated = !!token

  const login = (accessToken, csrf, userEmail) => {
    setToken(accessToken)
    setEmail(userEmail)
    
    storage.setAccessToken(accessToken)
    storage.setRefreshCsrf(csrf)
    storage.setEmail(userEmail)
  }

  const logout = () => {
    setToken(null)
    setEmail(null)

    storage.clearAuth()
  }

  const value = {
    email,
    token,
    isAuthenticated,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}