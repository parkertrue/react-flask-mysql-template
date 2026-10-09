import { createContext } from 'react'

// Kept apart from AuthProvider: Vite's fast refresh only works on files that
// export nothing but components.
export const AuthContext = createContext(null)
