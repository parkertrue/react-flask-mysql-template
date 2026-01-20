import { createContext, useState } from 'react'
import { storage } from '../utils/storage'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storage.getAccessToken())
  const [refreshCsrf, setRefreshCsrf] = useState(() => storage.getRefreshCsrf())
  const [email, setEmail] = useState(() => storage.getEmail())
  
  const isAuthenticated = !!token

  const login = (accessToken, csrf, userEmail) => {
    setToken(accessToken)
    setRefreshCsrf(csrf)
    setEmail(userEmail)
    
    storage.setAccessToken(accessToken)
    storage.setRefreshCsrf(csrf)
    storage.setEmail(userEmail)
  }

  const logout = () => {
    setToken(null)
    setRefreshCsrf(null)
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