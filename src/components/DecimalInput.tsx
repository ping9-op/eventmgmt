import { useEffect, useState, type CSSProperties } from 'react'

/**
 * 소수점 입력이 가능한 숫자 입력칸.
 * 입력 중인 문자열("12.", "0.0")을 그대로 유지하고, 상위에는 number | null 만 전달한다.
 * (parseFloat(e.target.value) || 0 패턴은 소수점·0 입력이 지워지는 문제가 있음)
 */
export default function DecimalInput({ value, onChange, placeholder, style, className, integer }: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  placeholder?: string
  style?: CSSProperties
  className?: string
  /** true면 정수만 입력 (수량·연도 등) */
  integer?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value))

  // 외부에서 값이 바뀌면(초기 로드, 다른 행 삭제 등) 입력 중인 값과 다를 때만 동기화
  useEffect(() => {
    const parsed = text === '' || text === '.' ? null : parseFloat(text)
    if ((value ?? null) !== parsed) setText(value == null ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input inputMode={integer ? 'numeric' : 'decimal'} value={text} placeholder={placeholder} style={style} className={className}
      onChange={e => {
        const v = e.target.value.replace(/,/g, '')
        if (!(integer ? /^\d*$/ : /^\d*\.?\d*$/).test(v)) return
        setText(v)
        onChange(v === '' || v === '.' ? null : parseFloat(v))
      }} />
  )
}

/** 엑셀 등 외부 문자열 → 숫자 (천단위 콤마·통화기호 제거, 소수점 유지) */
export function parseAmount(raw: string): number | null {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}
