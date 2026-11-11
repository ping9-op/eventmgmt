/** 담당 세일즈 표시 — 고객사 담당자(contact_person)와 구분되도록 배지로 (리드관리·퍼널·팔로우업 공통) */
export default function OwnerBadge({ owner }: { owner: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: '#EEF2FF', color: '#4F46E5', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      👤 {owner || '—'}
    </span>
  )
}
