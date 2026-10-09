import { useSyncExternalStore } from 'react'
import { storage } from './storage'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }) {
  // Storage holds the one copy of the session. The api client ends it there
  // when a refresh fails, and other tabs change it too; reading it straight
  // from storage, every component sees each change at once.
  const token = useSyncExternalStore(storage.subscribe, storage.getAccessToken)
  const email = useSyncExternalStore(storage.subscribe, storage.getEmail)

  const login = (accessToken, csrf, userEmail) => {
    storage.setEmail(userEmail)
    storage.setRefreshCsrf(csrf)
    storage.setAccessToken(accessToken)
  }

  const value = {
    email,
    isAuthenticated: !!token,
    login,
    logout: storage.clearAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
