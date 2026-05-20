import { createContext, useContext, useState, ReactNode } from 'react'
import translations from '../i18n'
import type { Lang } from '../i18n'

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LangContext = createContext<LangContextType | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('gme_lang')
    const l: Lang = (saved === 'en' || saved === 'ko') ? saved as Lang : 'ko'
    document.documentElement.lang = l === 'en' ? 'en' : 'ko'
    return l
  })

  function setLang(l: Lang) {
    localStorage.setItem('gme_lang', l)
    document.documentElement.lang = l === 'en' ? 'en' : 'ko'
    setLangState(l)
  }

  function t(key: string): string {
    const val = translations[lang][key]
    if (val !== undefined) return val
    const fallback = translations['ko'][key]
    return fallback !== undefined ? fallback : key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
