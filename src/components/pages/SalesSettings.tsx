import { useEffect, useRef, useState } from 'react'
import {
  loadAllSettings, saveSetting,
  STAGE_ORDER, PRIORITY_OPTS, CONTRACT_STATUSES, ONBOARD_STATUSES,
  type SalesSettingsData,
} from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'

// ── 설정 그룹 정의 ──────────────────────────────────────────────────────────
const EDITABLE_GROUPS: { key: keyof SalesSettingsData; label: string; desc: string; icon: string }[] = [
  { key: 'owners',          label: '담당자 (Owner)',         desc: '영업 담당자 목록',          icon: '👤' },
  { key: 'event_names',     label: '행사명 (Event Name)',    desc: '리드를 연결할 박람회/행사',  icon: '🏛' },
  { key: 'sources',         label: 'Lead Source',            desc: '리드 유입 경로',             icon: '📥' },
  { key: 'corridors',       label: '송금 경로 (Corridor)',   desc: '국가별 송금 경로',           icon: '🌏' },
  { key: 'business_types',  label: '사업 유형 (Biz Type)',   desc: '고객사 업종 분류',           icon: '🏢' },
  { key: 'contact_methods', label: '연락 방법',              desc: 'Activity 연락 수단',         icon: '📞' },
  { key: 'lost_reasons',    label: 'Lost Reason',            desc: '영업 실패 사유',             icon: '❌' },
]

const READONLY_GROUPS = [
  { label: 'Funnel Stage',       items: STAGE_ORDER,        icon: '🔀', desc: '영업 단계 순서 (시스템 고정)' },
  { label: '우선순위 (Priority)', items: PRIORITY_OPTS,      icon: '⚡', desc: 'High / Medium / Low (고정)' },
  { label: '계약 상태',           items: CONTRACT_STATUSES,  icon: '📄', desc: '제안서/계약서 상태 (고정)' },
  { label: '온보딩 상태',          items: ONBOARD_STATUSES,  icon: '✅', desc: '온보딩 진행 상태 (고정)' },
]

// ── 편집 가능 설정 카드 ─────────────────────────────────────────────────────
function EditableCard({
  icon, label, desc, items, onAdd, onRemove, saving,
}: {
  icon: string; label: string; desc: string; items: string[]
  onAdd: (val: string) => void; onRemove: (i: number) => void; saving: boolean
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const v = input.trim()
    if (!v || items.includes(v)) { if (!v) return; alert('이미 존재하는 항목입니다.'); return }
    onAdd(v)
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#FDFBFB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, background: '#E0E0E0', borderRadius: 99, padding: '2px 8px', color: '#555', fontWeight: 600 }}>
            {items.length}개
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
      </div>

      {/* 추가 입력 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="새 항목 입력 후 Enter 또는 추가 클릭"
          style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13 }}
        />
        <button
          onClick={submit}
          disabled={saving}
          style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          + 추가
        </button>
      </div>

      {/* 목록 */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
        {items.length === 0 && (
          <div style={{ padding: '12px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>항목이 없습니다</div>
        )}
        {items.map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: 'var(--light)', borderRadius: 7, gap: 10 }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{v}</span>
            <button
              onClick={() => { if (confirm(`"${v}"을(를) 삭제하시겠습니까?`)) onRemove(i) }}
              style={{ padding: '2px 9px', borderRadius: 5, background: 'white', border: '1px solid #FCA5A5', fontSize: 11, cursor: 'pointer', color: '#DC2626', flexShrink: 0 }}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 읽기 전용 카드 ─────────────────────────────────────────────────────────
function ReadonlyCard({ icon, label, desc, items }: { icon: string; label: string; desc: string; items: string[] }) {
  return (
    <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden', opacity: 0.85 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F5F0F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, background: '#E8D8D8', borderRadius: 99, padding: '2px 8px', color: '#8C2226', fontWeight: 700 }}>
            시스템 고정
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', background: '#F9F5F5', borderRadius: 7, gap: 10 }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function SalesSettings() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState<SalesSettingsData | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  useEffect(() => {
    loadAllSettings()
      .then(s => { setSettings(s); setLoading(false) })
      .catch(() => { setDbError(true); setLoading(false) })
  }, [])

  async function handleAdd(key: keyof SalesSettingsData, val: string) {
    if (!settings) return
    const updated = [...settings[key], val]
    setSettings(s => s ? { ...s, [key]: updated } : s)
    setSaving(key)
    try {
      await saveSetting(key, updated)
      showToast('저장되었습니다.')
    } catch {
      showToast('저장 실패. 네트워크를 확인하세요.')
      setSettings(s => s ? { ...s, [key]: s[key].filter(v => v !== val) } : s)
    }
    setSaving(null)
  }

  async function handleRemove(key: keyof SalesSettingsData, idx: number) {
    if (!settings) return
    const updated = settings[key].filter((_, i) => i !== idx)
    setSettings(s => s ? { ...s, [key]: updated } : s)
    setSaving(key)
    try {
      await saveSetting(key, updated)
      showToast('삭제되었습니다.')
    } catch {
      showToast('삭제 실패.')
      setSettings(await loadAllSettings())
    }
    setSaving(null)
  }

  if (loading) return (
    <div className="view wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
      설정 불러오는 중...
    </div>
  )

  if (dbError || !settings) return (
    <div className="view wide">
      <div style={{ background: '#FFF0F0', border: '1px solid #FCA5A5', borderRadius: 12, padding: 24, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>⚠ 설정 DB 연결 오류</div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 12 }}>
          <code>sales_settings</code> 테이블이 존재하지 않습니다.<br />
          Supabase 대시보드 → SQL Editor에서 아래 파일을 실행해주세요:
        </div>
        <code style={{ display: 'block', background: '#F5F0F0', padding: '8px 12px', borderRadius: 7, fontSize: 12 }}>
          supabase_settings_migration.sql
        </code>
        <button
          onClick={() => { setLoading(true); setDbError(false); loadAllSettings().then(s => { setSettings(s); setLoading(false) }).catch(() => { setDbError(true); setLoading(false) }) }}
          className="btn btn-primary btn-sm"
          style={{ marginTop: 14 }}
        >
          🔄 다시 시도
        </button>
      </div>
    </div>
  )

  return (
    <div className="view wide">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">Sales 설정</div>
        <div className="sub">Sales 모듈 마스터 데이터 관리 · 변경사항은 자동 저장됩니다</div>
      </div>

      {/* 편집 가능 설정 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          편집 가능한 설정
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {EDITABLE_GROUPS.map(g => (
            <EditableCard
              key={g.key}
              icon={g.icon}
              label={g.label}
              desc={g.desc}
              items={settings[g.key]}
              saving={saving === g.key}
              onAdd={val => handleAdd(g.key, val)}
              onRemove={idx => handleRemove(g.key, idx)}
            />
          ))}
        </div>
      </div>

      {/* 시스템 고정 설정 */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          시스템 고정 설정 (수정 불가)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {READONLY_GROUPS.map(g => (
            <ReadonlyCard key={g.label} icon={g.icon} label={g.label} desc={g.desc} items={g.items} />
          ))}
        </div>
      </div>
    </div>
  )
}
