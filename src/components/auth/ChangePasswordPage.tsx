import { useState, FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// change_initial_password RPC가 던지는 예외 코드 → 안내 문구
const ERROR_MESSAGES: Record<string, string> = {
  invalid_current_password: '현재 비밀번호가 올바르지 않습니다.',
  weak_password: '새 비밀번호는 8자 이상, 영문과 숫자를 모두 포함해야 합니다.',
  same_password: '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
}

// 첫 로그인 시 강제 비밀번호 변경 화면 (app_metadata.must_change_password 대상)
export default function ChangePasswordPage() {
  const { user, signOut } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      setError(ERROR_MESSAGES.weak_password)
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    if (next === current) {
      setError(ERROR_MESSAGES.same_password)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('change_initial_password', {
        current_password: current,
        new_password: next,
      })
      if (error) {
        const code = Object.keys(ERROR_MESSAGES).find(k => error.message.includes(k))
        setError(code ? ERROR_MESSAGES[code] : '비밀번호 변경에 실패했습니다. 다시 시도해주세요.')
        return
      }
      // 토큰을 갱신해야 app_metadata에서 must_change_password가 빠진 사용자 정보가 반영됨
      await supabase.auth.refreshSession()
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const pwType = showPw ? 'text' : 'password'

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">● GME Event Management</div>
        <div className="login-sub">처음 로그인하셨습니다 · 새 비밀번호를 설정해주세요</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{ marginTop: 0 }}>이메일</label>
          <input type="email" value={user?.email || ''} disabled />

          <label>현재 비밀번호 (임시 비밀번호)</label>
          <input
            type={pwType}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            placeholder="••••••••"
            required
            autoFocus
          />

          <label>새 비밀번호</label>
          <input
            type={pwType}
            value={next}
            onChange={e => setNext(e.target.value)}
            placeholder="8자 이상, 영문+숫자"
            required
          />

          <label>새 비밀번호 확인</label>
          <input
            type={pwType}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} style={{ width: 'auto' }} />
            비밀번호 보기
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 24, padding: '13px' }}
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => signOut()}
          style={{
            display: 'block', margin: '16px auto 0', background: 'none', border: 'none',
            fontSize: 12, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
