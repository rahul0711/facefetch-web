import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'
import { subscribe } from '../services/db'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getSession())

  // Keep the user object fresh when their profile changes in the mock DB.
  useEffect(() => subscribe(() => setSession(authService.getSession())), [])

  const login = useCallback(async (email, password) => {
    const s = await authService.login(email, password)
    setSession(s)
    return s
  }, [])

  const signup = useCallback(async (data) => {
    const s = await authService.signup(data)
    setSession(s)
    return s
  }, [])

  const loginAsRole = useCallback(async (role) => {
    const s = await authService.loginAsRole(role)
    setSession(s)
    return s
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ user: session?.user || null, login, signup, logout, loginAsRole }),
    [session, login, signup, logout, loginAsRole],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
