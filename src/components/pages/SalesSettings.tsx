import { useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { loadSalesSettings, saveSalesSettings, DEFAULT_OWNERS, DEFAULT_SOURCES, DEFAULT_BUSINESS_TYPES, DEFAULT_CORRIDORS } from '../../lib/settings'

const DEFAULT_STAGES = ['New Lead', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Onboarding', 'Onboarded / Won', 'Lost']

type ListKey = 'owners' | 'sources' | 'businessTypes' | 'corridors'

function loadSettings() { return loadSalesSettings() }
function saveSettings(data: object) { saveSalesSettings(data as any) }

function EditableList({
  title, items, onAdd, onRemove, placeholder,
}: {
  title: string
  items: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function handleAdd() {
    const v = input.trim()
    if (!v || items.includes(v)) return
    onAdd(v)
    setInput('')
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {items.map(item => (
          <div key={item} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--light)', borderRadius: 20, padding: '5px 12px',
            fontSize: 13, fontWeight: 500,
          }}>
            <span>{item}</span>
            <button
              onClick={() => onRemove(item)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: 0 }}
              title="삭제"
            >×</button>
          </div>
        ))}
        {items.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>항목 없음</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder || '새 항목 입력'}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!input.trim()}>추가</button>
      </div>
    </div>
  )
}

export default function SalesSettings() {
  const { lang, setLang } = useLang()
  const { user, signOut } = useAuth()
  const { showToast } = useToast()

  const saved = loadSettings()
  const [owners, setOwners] = useState<string[]>(saved?.owners || DEFAULT_OWNERS)
  const [sources, setSources] = useState<string[]>(saved?.sources || DEFAULT_SOURCES)
  const [businessTypes, setBusinessTypes] = useState<string[]>(saved?.businessTypes || DEFAULT_BUSINESS_TYPES)
  const [corridors, setCorridors] = useState<string[]>(saved?.corridors || DEFAULT_CORRIDORS)
  function persist(key: ListKey, value: string[]) {
    const current = loadSettings()
    saveSettings({ ...current, [key]: value })
    showToast('설정이 저장되었습니다.')
  }

  function addItem(key: ListKey, setter: (fn: (prev: string[]) => string[]) => void, value: string) {
    setter(prev => {
      const next = [...prev, value]
      persist(key, next)
      return next
    })
  }

  function removeItem(key: ListKey, setter: (fn: (prev: string[]) => string[]) => void, value: string) {
    setter(prev => {
      const next = prev.filter(v => v !== value)
      persist(key, next)
      return next
    })
  }

  function resetAll() {
    if (!window.confirm('모든 설정을 초기값으로 되돌리시겠습니까?')) return
    localStorage.removeItem('gme_sales_settings')
    setOwners(DEFAULT_OWNERS)
    setSources(DEFAULT_SOURCES)
    setBusinessTypes(DEFAULT_BUSINESS_TYPES)
    setCorridors(DEFAULT_CORRIDORS)
  }

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">Sales 설정</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={resetAll}>초기화</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <EditableList
            title="담당자 목록"
            items={owners}
            onAdd={v => addItem('owners', setOwners, v)}
            onRemove={v => removeItem('owners', setOwners, v)}
            placeholder="담당자 이름"
          />
          <EditableList
            title="Lead 소스"
            items={sources}
            onAdd={v => addItem('sources', setSources, v)}
            onRemove={v => removeItem('sources', setSources, v)}
            placeholder="소스명"
          />
        </div>
        <div>
          <EditableList
            title="업종"
            items={businessTypes}
            onAdd={v => addItem('businessTypes', setBusinessTypes, v)}
            onRemove={v => removeItem('businessTypes', setBusinessTypes, v)}
            placeholder="업종명"
          />
          <EditableList
            title="코리도 (Country Corridor)"
            items={corridors}
            onAdd={v => addItem('corridors', setCorridors, v)}
            onRemove={v => removeItem('corridors', setCorridors, v)}
            placeholder="예: Korea → Canada"
          />
        </div>
      </div>

      {/* Stage 목록 (수정 불가 — 코드 레벨 고정) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
          Sales Stage
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>코드에서 고정 관리</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEFAULT_STAGES.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{i + 1}.</span>
              <span style={{ background: 'var(--light)', borderRadius: 6, padding: '5px 12px', fontSize: 13 }}>{s}</span>
              {i < DEFAULT_STAGES.length - 1 && <span style={{ color: 'var(--muted)', fontSize: 14 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 앱 설정 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>앱 설정</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>언어</div>
            <div style={{ display: 'flex', background: 'var(--light)', borderRadius: 8, padding: 3, gap: 2 }}>
              {(['ko', 'en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '6px 18px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: lang === l ? 'var(--accent)' : 'transparent',
                  color: lang === l ? 'white' : 'var(--muted)',
                }}>{l === 'ko' ? '한국어' : 'English'}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>로그인 계정</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.email || '-'}</div>
          </div>
          <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={signOut}>
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
        * 담당자, Lead 소스, 업종, 코리도 변경사항은 브라우저 로컬 스토리지에 저장됩니다. Lead 등록 시 반영됩니다.
      </div>
    </div>
  )
}
