"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { api } from "@/lib/api"
import { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const stored = localStorage.getItem("token")
    if (!stored) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false)
      })
      return () => { cancelled = true }
    }
    api.me().then((currentUser) => {
      if (cancelled) return
      setToken(stored)
      setUser(currentUser)
    }).catch(() => {
      if (!cancelled) {
        localStorage.removeItem("token")
        setToken(null)
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const login = async (email: string, password: string) => {
    const { token } = await api.login(email, password)
    localStorage.setItem("token", token)
    setToken(token)
    const user = await api.me()
    setUser(user)
  }

  const register = async (email: string, password: string) => {
    await api.register(email, password)
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
