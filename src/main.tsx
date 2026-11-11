import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// 배포 후에도 저장된 예전 화면이 계속 보이는 문제 방지
// - 새 버전 서비스워커가 설치되면 autoUpdate 모드가 페이지를 새로고침해 새 화면으로 바꿈
// - 탭을 오래 열어둬도 1시간마다 새 버전 확인
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => { reg.update().catch(() => {}) }, 60 * 60 * 1000)
  },
})
// 새 배포로 예전 화면 조각(js) 파일이 사라져 열리지 않을 때 한 번 새로고침
window.addEventListener('vite:preloadError', () => {
  // 1분 안에 다시 실패하면 새로고침 반복을 막기 위해 멈춤
  const last = Number(sessionStorage.getItem('preload-reloaded-at') || 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem('preload-reloaded-at', String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  </StrictMode>
)
