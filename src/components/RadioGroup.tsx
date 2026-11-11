interface Props {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

/** 버튼형 라디오 — 다시 누르면 선택 해제 */
export default function RadioGroup({ value, onChange, options }: Props) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(active ? '' : o.value)}
            style={{ flex: 1, minWidth: 100, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`, background: active ? 'var(--accent)' : 'white', color: active ? 'white' : 'var(--muted)' }}>
            {active ? '● ' : '○ '}{o.label}
          </button>
        )
      })}
    </div>
  )
}
