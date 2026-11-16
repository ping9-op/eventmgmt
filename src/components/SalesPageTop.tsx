// 세일즈 화면 공용 상단 — 리드관리·퍼널·팔로우업이 같은 순서·모양을 쓴다
//   ① 헤더(제목 + 주요 버튼) → ② 보기 탭 → ③ 검색·필터·건수
// 보기를 바꿔도 이 세 줄은 같은 자리에 있어야 한다 (feedback: 상단이 화면마다 달라 헷갈림)
import type { ReactNode } from 'react'

/** ① 제목 + 주요 동작 버튼 */
export function SalesHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div className="sec-hdr" style={{ margin: 0, flex: 1, minWidth: 200 }}>
        <div className="bar" />
        <div className="txt">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export interface ViewTab<K extends string> { key: K; label: string; count?: number }

/** ② 보기 방식 탭 (알약 모양) */
export function SalesViewTabs<K extends string>({ tabs, active, onChange }: {
  tabs: ViewTab<K>[]
  active: K
  onChange: (k: K) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--light)', borderRadius: 10, marginBottom: 12, overflowX: 'auto' }}>
      {tabs.map(tab => {
        const on = tab.key === active
        return (
          <button key={tab.key} onClick={() => onChange(tab.key)}
            style={{ flex: 1, minWidth: 96, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', background: on ? 'white' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>
            {tab.label}
            {tab.count !== undefined && (
              <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, fontSize: 11, background: on ? 'var(--accent-light)' : 'rgba(0,0,0,.06)', color: on ? 'var(--accent)' : 'var(--muted)' }}>{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** ③ 검색 + 담당자 필터(관리자) + 적용 중인 필터 칩 + 건수 */
export function SalesFilterBar({ search, onSearch, placeholder, owners, owner, onOwner, count, children }: {
  search: string
  onSearch: (v: string) => void
  placeholder?: string
  /** 관리자에게만 넘김 — 매니저는 본인 것만 보이므로 담당자 필터 불필요 */
  owners?: string[]
  owner?: string | null
  onOwner?: (v: string | null) => void
  count: number
  /** 적용 중인 필터 칩 (FilterChip) */
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <input value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder || '🔍 회사명, 담당자 검색'}
        className="leads-search-input"
        style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13 }} />
      {owners && onOwner && (
        <select value={owner || ''} onChange={e => onOwner(e.target.value || null)}
          style={{ padding: '8px 10px', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, width: 'auto' }}>
          <option value="">👤 전체 담당자</option>
          {owners.map(o => <option key={o}>{o}</option>)}
        </select>
      )}
      {children}
      <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
        총 <b style={{ color: 'var(--text)' }}>{count}</b>건
      </span>
    </div>
  )
}

/** 적용 중인 필터 표시 (✕로 해제) */
export function FilterChip({ label, color, bg, onClear }: { label: string; color: string; bg: string; onClear: () => void }) {
  return (
    <span style={{ background: bg, color, padding: '5px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {label}
      <button onClick={onClear} title="필터 해제" style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 13, marginLeft: 2, padding: 0 }}>✕</button>
    </span>
  )
}

/** 담당자 필터 목록: 설정의 담당자 + 실제 데이터에 있는 담당자(설정에서 빠진 사람) + 현재 선택값 */
export function ownerOptions(settingOwners: string[] | undefined, rowOwners: (string | null | undefined)[], current: string | null): string[] {
  return [...new Set([...(settingOwners || []), ...rowOwners, ...(current ? [current] : [])].filter((x): x is string => !!x))]
}
