// =============================================================================
// context/AuthContext.jsx — Global Authentication State
// =============================================================================
// Provides login state to all components in the app.
// Stores JWT token in localStorage and decodes user info from it.
// =============================================================================

import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null)   // { id, name, email, role }
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load token from localStorage on app start
  useEffect(() => {
    const savedToken = localStorage.getItem('phishguard_token')
    const savedUser  = localStorage.getItem('phishguard_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = (tokenData) => {
    // tokenData = { access_token, user_id, name, role }
    const userData = {
      id:   tokenData.user_id,
      name: tokenData.name,
      role: tokenData.role,
    }
    localStorage.setItem('phishguard_token', tokenData.access_token)
    localStorage.setItem('phishguard_user',  JSON.stringify(userData))
    setToken(tokenData.access_token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('phishguard_token')
    localStorage.removeItem('phishguard_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook for easy access
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
