import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate()
  const { lang, setLang } = useLang()
  const { user, signOut, isAdmin } = useAuth()
  const [overdueCount, setOverdueCount] = useState(0)

  // 결제 기한 초과 건수 조회 (D-day 알림)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchOverdue() {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [dep, fin] = await Promise.all([
          supabase.from('payments').select('id').lt('deposit_due', today).eq('deposit_paid', false).not('deposit_due', 'is', null),
          supabase.from('payments').select('id').lt('final_due', today).eq('final_paid', false).not('final_due', 'is', null),
        ])
        if (!cancelled) {
          setOverdueCount((dep.data?.length || 0) + (fin.data?.length || 0))
        }
      } catch (err) {
        console.error('overdue fetch failed', err)
      }
    }
    fetchOverdue()
    return () => { cancelled = true }
  }, [user])

  return (
    <div className="topbar">
      {/* 햄버거 메뉴 (모바일) */}
      <button className="topbar-hamburger" onClick={onMenuClick} aria-label="메뉴">
        <span /><span /><span />
      </button>

      <span className="logo" onClick={() => navigate('/')}>
        <span className="logo-text">● GME Event Management</span>
        <span className="logo-mobile">EMSF</span>
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* 결제 D-day 알림 뱃지 */}
        {overdueCount > 0 && (
          <button onClick={() => navigate('/expo/payments')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
              minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={`결제 기한 초과 ${overdueCount}건`}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <span style={{ position: 'absolute', top: 0, right: 0, background: '#DC2626', color: 'white',
              fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 5px', minWidth: 16, textAlign: 'center', lineHeight: '14px' }}>
              {overdueCount > 9 ? '9+' : overdueCount}
            </span>
          </button>
        )}

        {/* 관리자 뱃지 */}
        {isAdmin && (
          <span style={{ fontSize: 10, background: 'rgba(255,209,102,.25)', color: 'var(--sb-ind)',
            border: '1px solid rgba(255,209,102,.4)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
            ADMIN
          </span>
        )}

        <span className="topbar-email">{user?.email}</span>

        {/* 언어 전환 */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: 3, gap: 2 }}>
          {([['ko', '한국어'], ['en', 'EN'], ['ja', '日本語']] as const).map(([l, label]) => (
            <button key={l} onClick={() => setLang(l as any)}
              className={lang === l ? 'lang-active' : 'lang-inactive'}
              style={{ padding: '10px 12px', borderRadius: 6, fontSize: 12, fontWeight: lang === l ? 700 : 600,
                border: 'none', cursor: 'pointer', minHeight: 44,
                background: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? 'white' : 'rgba(255,255,255,.6)', transition: 'all .2s' }}>
              {label}
            </button>
          ))}
        </div>

        <button onClick={signOut}
          style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
            color: 'rgba(255,255,255,.7)', borderRadius: 6, padding: '10px 12px', fontSize: 12, cursor: 'pointer', minHeight: 44 }}>
          <span className="logout-full">로그아웃</span>
          <span className="logout-short">나가기</span>
        </button>
      </div>
    </div>
  )
}
