import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// 관리자 이메일 목록 — Supabase user_metadata.role='admin' 으로도 설정 가능
const ADMIN_EMAILS = ['andrewc@gmeremit.com']

// 자동 로그아웃: 2시간 이상 활동 없으면 로그아웃
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000
const LAST_ACTIVITY_KEY = 'gme_last_activity'
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
      })
      .catch(() => {/* 네트워크 오류 무시 — loading만 해제 */})
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    let lastWrite = 0
    const markActivity = () => {
      const now = Date.now()
      if (now - lastWrite < 5000) return // 과도한 localStorage 쓰기 방지
      lastWrite = now
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now))
    }

    const checkIdle = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now()
      if (Date.now() - last >= IDLE_TIMEOUT_MS) {
        supabase.auth.signOut()
      }
    }

    markActivity()
    checkIdle() // 탭을 닫았다가 2시간 후 다시 열었을 때도 즉시 체크

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, markActivity))
    const interval = setInterval(checkIdle, 60 * 1000)

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, markActivity))
      clearInterval(interval)
    }
  }, [session])

  const isAdmin = !!(
    user && (
      ADMIN_EMAILS.includes(user.email || '') ||
      (user.user_metadata as any)?.role === 'admin'
    )
  )

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }



  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
