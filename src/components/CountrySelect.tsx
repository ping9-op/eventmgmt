import { useState } from 'react'
import { COUNTRIES } from '../lib/corridor'

const CUSTOM = '__custom__'

interface Props {
  value: string
  onChange: (value: string) => void
  /** 이미 저장된 국가명 — 표준 목록에 없는 값도 선택지에 보이도록 */
  known?: string[]
}

/**
 * 송금 국가 선택 + 직접 입력 (EventSelect와 같은 방식)
 * datalist는 칸에 값이 있으면 그 글자로 목록을 걸러 'Other' 같은 값일 때 드롭다운이 비어 보여서 select로 바꿈
 */
export default function CountrySelect({ value, onChange, known = [] }: Props) {
  const [custom, setCustom] = useState(false)
  const [before, setBefore] = useState(value)
  const [typed, setTyped] = useState('')
  const options = [...new Set([...COUNTRIES, ...known, ...(value ? [value] : []), 'Other'])]
  return (
    <>
      <select value={custom ? CUSTOM : value}
        onChange={e => {
          if (e.target.value === CUSTOM) { setBefore(value); setTyped(''); setCustom(true); return }
          setCustom(false)
          onChange(e.target.value)
        }}>
        <option value="">—</option>
        {options.map(c => <option key={c} value={c}>{c}</option>)}
        <option value={CUSTOM}>✏️ 직접 입력…</option>
      </select>
      {custom && (
        <input autoFocus value={typed}
          onChange={e => { setTyped(e.target.value); onChange(e.target.value.trim() ? e.target.value : before) }}
          placeholder="목록에 없는 국가 (예: Laos)" style={{ marginTop: 6 }} />
      )}
    </>
  )
}
