import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setUnauthorizedHandler } from '../services/api'
import * as authService from '../services/authService'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getSession())

  // A 401 from the API (expired or revoked token) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      authService.logout()
      setSession(null)
    })
  }, [])

  // Refresh the profile once per load (name/avatar/active flag may have changed).
  useEffect(() => {
    if (!session) return
    authService
      .refreshMe()
      .then((user) => user && setSession((s) => (s ? { ...s, user } : s)))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (email, password) => {
    const s = await authService.login(email, password)
    setSession(s)
    return s
  }, [])

  const setUser = useCallback((user) => setSession((s) => (s ? { ...s, user } : s)), [])

  const logout = useCallback(() => {
    authService.logout()
    setSession(null)
  }, [])

  const value = useMemo(() => ({ user: session?.user || null, login, logout, setUser }), [session, login, logout, setUser])
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
