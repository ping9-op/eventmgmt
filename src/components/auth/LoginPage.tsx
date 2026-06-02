import { useState, FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">● GME Event Management</div>
        <div className="login-sub">Korea Team · 이벤트 관리 시스템</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={{ marginTop: 0 }}>이메일</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="andrewc@gmeremit.com"
            required
            autoFocus
          />
          <label>비밀번호</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, color: 'var(--muted)', padding: '0 2px', lineHeight: 1,
              }}
              tabIndex={-1}
              title={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 24, padding: '13px' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>
          계정 문의: 관리자(andrewc@gmeremit.com)에게 요청하세요
        </p>
      </div>
    </div>
  )
}
