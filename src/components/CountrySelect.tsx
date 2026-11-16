import { useState } from 'react'
import { COUNTRIES, COUNTRY_ALIASES, canonicalCountry } from '../lib/corridor'

interface Props {
  value: string
  onChange: (value: string) => void
  /** 이미 저장된 국가명 — 표준 목록에 없는 값도 추천에 보이도록 */
  known?: string[]
}

/**
 * 송금 국가 입력 + 추천 목록
 * - 칸을 누르면 전체 목록, 타이핑하면 일치하는 국가만 (영문 일부·한글 이름 모두: 'jap', '일본' → Japan)
 * - 목록에 없는 나라는 그대로 입력하면 저장 (칸을 벗어날 때 표준 표기로 정리)
 * 브라우저 datalist는 현재 값으로 목록을 걸러 'Other'일 때 비어 보여서 직접 구현
 */
export default function CountrySelect({ value, onChange, known = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const all = [...new Set([...COUNTRIES, ...known, 'Other'])]
  const q = query.trim().toLowerCase()
  const items = !q ? all : all
    .filter(c => c.toLowerCase().includes(q) || Object.entries(COUNTRY_ALIASES).some(([k, v]) => v === c && k.includes(q)))
    .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))

  const pick = (c: string) => { onChange(c); setQuery(''); setOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <input value={value} placeholder="국가 입력 (예: Japan, 일본)" autoComplete="off"
        onFocus={() => { setQuery(''); setActive(0); setOpen(true) }}
        onBlur={() => { setOpen(false); const c = canonicalCountry(value, known); if (c !== value) onChange(c) }}
        onChange={e => { onChange(e.target.value); setQuery(e.target.value); setActive(0); setOpen(true) }}
        onKeyDown={e => {
          if (!open || !items.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, items.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); pick(items[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }} />
      {open && items.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          maxHeight: 220, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border2)',
          borderRadius: 7, boxShadow: '0 4px 14px rgba(0,0,0,.12)',
        }}>
          {items.map((c, i) => (
            <div key={c}
              onMouseDown={e => { e.preventDefault(); pick(c) }}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: '8px 10px', fontSize: 13, cursor: 'pointer',
                background: i === active ? 'var(--accent-light)' : undefined,
                fontWeight: c === value ? 700 : 400,
              }}>
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
