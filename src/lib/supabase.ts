import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 이전 버전이 localStorage에 남긴 로그인 토큰 제거 — 브라우저를 닫아도 남아 있던 세션을 정리
try {
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    .forEach(k => localStorage.removeItem(k))
} catch {/* 저장소 접근 불가 시 무시 */}

// 로그인 세션은 sessionStorage에 보관 — 탭이나 브라우저를 닫으면 즉시 로그아웃됨
// (새 탭에서 주소를 직접 입력해 열면 다시 로그인해야 함)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
