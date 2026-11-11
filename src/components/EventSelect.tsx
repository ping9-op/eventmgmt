import { useState } from 'react'
import type { EventOption } from '../lib/leadEvents'

const CUSTOM = '__custom__'

interface Props {
  /** 'p:<proposalId>' / 't:<행사명>' / '' */
  value: string
  onChange: (value: string) => void
  options: EventOption[]
  placeholder: string
}

/**
 * 행사 선택 + 직접 입력
 * 우리가 참가하지 않고 방문만 하는 행사처럼 목록에 없는 행사는 '직접 입력'으로 이름을 적는다 (박람회 외 행사 't:<이름>'로 저장)
 */
export default function EventSelect({ value, onChange, options, placeholder }: Props) {
  const [custom, setCustom] = useState(false)
  // '직접 입력'을 고른 뒤 아무것도 안 쓰면 원래 행사를 유지 (빈 값으로 지워지지 않도록)
  const [before, setBefore] = useState(value)
  const [typed, setTyped] = useState('')
  return (
    <>
      <select value={custom ? CUSTOM : value}
        onChange={e => {
          if (e.target.value === CUSTOM) { setBefore(value); setTyped(''); setCustom(true); return }
          setCustom(false)
          onChange(e.target.value)
        }}>
        <option value="">{placeholder}</option>
        <option value={CUSTOM}>✏️ 직접 입력…</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {custom && (
        <input autoFocus value={typed}
          onChange={e => { setTyped(e.target.value); onChange(e.target.value.trim() ? `t:${e.target.value}` : before) }}
          placeholder="행사명 입력 (예: 방문한 박람회·행사)" style={{ marginTop: 6 }} />
      )}
    </>
  )
}
