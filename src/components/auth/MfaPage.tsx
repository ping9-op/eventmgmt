import { useEffect, useState, FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// 2단계 인증(OTP) 화면 — 전 계정 필수
// - 등록된 OTP가 없으면: QR 코드로 인증 앱(Google Authenticator 등) 등록 → 6자리 코드 확인
// - 등록돼 있으면: 6자리 코드 입력
// 휴대폰 분실 시 관리자가 권한 관리 화면에서 OTP를 초기화하면 다시 등록 화면이 뜸
export default function MfaPage() {
  const { user, signOut } = useAuth()
  const [mode, setMode] = useState<'loading' | 'enroll' | 'verify'>('loading')
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      setError('')
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (error) { setError('인증 정보를 불러오지 못했습니다. 새로고침해주세요.'); return }
      const verified = data.totp.find(f => f.status === 'verified')
      if (verified) { setFactorId(verified.id); setMode('verify'); return }

      // 등록하다 중단된(미확인) OTP는 정리 후 새로 등록
      for (const f of data.all.filter(f => f.factor_type === 'totp' && f.status !== 'verified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `GME EM ${Date.now()}` })
      if (cancelled) return
      if (enrollErr || !enrolled) { setError('OTP 등록을 시작하지 못했습니다: ' + (enrollErr?.message || '')); return }
      setFactorId(enrolled.id)
      setQr(enrolled.totp.qr_code)
      setSecret(enrolled.totp.secret)
      setMode('enroll')
    }
    init()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code)) { setError('인증 앱에 표시된 6자리 숫자를 입력하세요.'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) { setError('코드가 올바르지 않습니다. 앱의 최신 코드를 입력하세요.'); setCode(''); return }
      // 성공 시 세션이 aal2로 갱신되어 AuthContext가 앱 화면으로 전환
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">● GME Event Management</div>
        <div className="login-sub">
          {mode === 'enroll' ? '2단계 인증 등록 · 처음 한 번만 필요합니다' : '2단계 인증 · 인증 앱의 코드를 입력하세요'}
        </div>

        {error && <div className="login-error">{error}</div>}

        {mode === 'loading' && !error && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>준비 중...</div>}

        {mode === 'enroll' && (
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
            1. 휴대폰에 <b style={{ color: 'var(--text)' }}>Google Authenticator</b> 또는 <b style={{ color: 'var(--text)' }}>Microsoft Authenticator</b> 앱을 설치하세요.<br />
            2. 앱에서 QR 코드를 스캔하세요.<br />
            3. 앱에 표시된 6자리 코드를 아래에 입력하세요.
            {qr && <img src={qr} alt="OTP 등록 QR 코드" style={{ display: 'block', width: 180, height: 180, margin: '14px auto', background: 'white', padding: 8, borderRadius: 8 }} />}
            <div style={{ fontSize: 12, textAlign: 'center', wordBreak: 'break-all' }}>
              QR 스캔이 안 되면 앱에 직접 입력: <code style={{ color: 'var(--text)' }}>{secret}</code>
            </div>
          </div>
        )}

        {mode !== 'loading' && (
          <form onSubmit={handleSubmit}>
            <label style={{ marginTop: 0 }}>{user?.email} · 6자리 코드</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
              style={{ letterSpacing: 6, textAlign: 'center', fontSize: 20 }}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}
              style={{ width: '100%', marginTop: 20, padding: '13px' }}>
              {busy ? '확인 중...' : mode === 'enroll' ? '등록 완료' : '확인'}
            </button>
          </form>
        )}

        <button type="button" onClick={() => signOut()}
          style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}>
          로그아웃
        </button>
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 12 }}>
          휴대폰을 바꾸거나 분실했다면 관리자에게 OTP 초기화를 요청하세요.
        </p>
      </div>
    </div>
  )
}
