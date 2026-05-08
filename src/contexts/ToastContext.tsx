import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast { id: number; message: string; type: ToastType }
interface ToastContextType { showToast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastContextType | null>(null)

const BG: Record<ToastType, string> = {
  success: '#2E7D51',
  error: '#D63031',
  info: '#1E3A5F',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: BG[t.type], color: 'white',
            padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            animation: 'toastIn .2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
