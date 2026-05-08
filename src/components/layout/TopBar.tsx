import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'

export default function TopBar() {
  const navigate = useNavigate()
  const { lang, setLang } = useLang()
  const { user, signOut } = useAuth()

  return (
    <div className="topbar">
      <span className="logo" onClick={() => navigate('/')}>
        ● <span>GME Event Management</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="sub">{user?.email}</span>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: 3, gap: 2 }}>
          <button
            onClick={() => setLang('ko')}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none',
              cursor: 'pointer', background: lang === 'ko' ? 'var(--accent)' : 'transparent',
              color: lang === 'ko' ? 'white' : 'rgba(255,255,255,.6)', transition: 'all .2s'
            }}
          >한국어</button>
          <button
            onClick={() => setLang('en')}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none',
              cursor: 'pointer', background: lang === 'en' ? 'var(--accent)' : 'transparent',
              color: lang === 'en' ? 'white' : 'rgba(255,255,255,.6)', transition: 'all .2s'
            }}
          >English</button>
        </div>
        <button
          onClick={signOut}
          style={{
            background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
            color: 'rgba(255,255,255,.7)', borderRadius: 6, padding: '5px 12px',
            fontSize: 12, cursor: 'pointer'
          }}
        >로그아웃</button>
      </div>
    </div>
  )
}
