import { useEffect, useRef, useState } from 'react'
import {
  loadAllSettings, saveSetting,
  STAGE_ORDER, PRIORITY_OPTS, CONTRACT_STATUSES, ONBOARD_STATUSES,
  type SalesSettingsData,
} from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'
import { useLang } from '../../contexts/LangContext'

// ── 편집 가능 설정 카드 ─────────────────────────────────────────────────────
function EditableCard({
  icon, label, desc, items, onAdd, onRemove, saving, addPlaceholder, addBtnLabel, deleteBtnLabel, itemsCountSuffix,
}: {
  icon: string; label: string; desc: string; items: string[]
  onAdd: (val: string) => void; onRemove: (i: number) => void; saving: boolean
  addPlaceholder: string; addBtnLabel: string; deleteBtnLabel: string; itemsCountSuffix: string
}) {
  const { t } = useLang()
  const { showToast } = useToast()
  const [input, setInput] = useState('')
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const v = input.trim()
    if (!v || items.includes(v)) { if (!v) return; showToast('⚠️ 이미 존재하는 항목입니다.'); return }
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
            {items.length}{itemsCountSuffix}
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
          placeholder={addPlaceholder}
          style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13 }}
        />
        <button
          onClick={submit}
          disabled={saving}
          style={{ padding: '7px 14px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          + {addBtnLabel}
        </button>
      </div>

      {/* 목록 */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
        {items.length === 0 && (
          <div style={{ padding: '12px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{t('no_items')}</div>
        )}
        {items.map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: 'var(--light)', borderRadius: 7, gap: 10 }}>
            <span style={{ width: 20, textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{v}</span>
            {confirmIdx === i ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>삭제?</span>
                <button onClick={() => { onRemove(i); setConfirmIdx(null) }}
                  style={{ padding: '2px 8px', borderRadius: 5, background: '#DC2626', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Yes</button>
                <button onClick={() => setConfirmIdx(null)}
                  style={{ padding: '2px 8px', borderRadius: 5, background: 'white', color: 'var(--muted)', border: '1px solid var(--border2)', fontSize: 11, cursor: 'pointer' }}>No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmIdx(i)}
                style={{ padding: '2px 9px', borderRadius: 5, background: 'white', border: '1px solid #FCA5A5', fontSize: 11, cursor: 'pointer', color: '#DC2626', flexShrink: 0 }}>
                {deleteBtnLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 읽기 전용 카드 ─────────────────────────────────────────────────────────
function ReadonlyCard({ icon, label, desc, items, systemFixedLabel }: { icon: string; label: string; desc: string; items: string[]; systemFixedLabel: string }) {
  return (
    <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden', opacity: 0.85 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F5F0F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, background: '#E8D8D8', borderRadius: 99, padding: '2px 8px', color: '#8C2226', fontWeight: 700 }}>
            {systemFixedLabel}
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
  const { t } = useLang()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<SalesSettingsData | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(false)

  // 설정 그룹 정의 (번역 적용)
  const EDITABLE_GROUPS: { key: keyof SalesSettingsData; label: string; desc: string; icon: string }[] = [
    { key: 'owners',          label: t('owner_label'),          desc: t('owner_desc'),          icon: '👤' },
    { key: 'event_names',     label: t('event_names_label'),    desc: t('event_names_desc'),    icon: '🏛' },
    { key: 'sources',         label: t('sources_label'),        desc: t('sources_desc'),        icon: '📥' },
    { key: 'corridors',       label: t('corridors_label'),      desc: t('corridors_desc'),      icon: '🌏' },
    { key: 'business_types',  label: t('biz_types_label'),      desc: t('biz_types_desc'),      icon: '🏢' },
    { key: 'contact_methods', label: t('contact_methods_label'),desc: t('contact_methods_desc'),icon: '📞' },
    { key: 'lost_reasons',    label: t('lost_reasons_label'),   desc: t('lost_reasons_desc'),   icon: '❌' },
  ]

  const READONLY_GROUPS = [
    { label: t('funnel_stage_label'), items: STAGE_ORDER,       icon: '🔀', desc: t('funnel_stage_desc') },
    { label: t('priority_label'),     items: PRIORITY_OPTS,     icon: '⚡', desc: t('priority_desc') },
    { label: t('contract_label'),     items: CONTRACT_STATUSES, icon: '📄', desc: t('contract_desc') },
    { label: t('onboard_label'),      items: ONBOARD_STATUSES,  icon: '✅', desc: t('onboard_desc') },
  ]

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
      showToast(t('saved_ok'))
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
      {t('settings_loading')}
    </div>
  )

  if (dbError || !settings) return (
    <div className="view wide">
      <div style={{ background: '#FFF0F0', border: '1px solid #FCA5A5', borderRadius: 12, padding: 24, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>{t('db_error_title')}</div>
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
          {t('retry')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="view wide">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">{t('s_settings_title')}</div>
        <div className="sub">{t('s_settings_sub')}</div>
      </div>

      {/* 편집 가능 설정 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          {t('editable_settings')}
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
              addPlaceholder={t('settings_add_placeholder')}
              addBtnLabel={t('add')}
              deleteBtnLabel={t('delete')}
              itemsCountSuffix={t('items_count')}
            />
          ))}
        </div>
      </div>

      {/* 시스템 고정 설정 */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          {t('readonly_settings')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {READONLY_GROUPS.map(g => (
            <ReadonlyCard key={g.label} icon={g.icon} label={g.label} desc={g.desc} items={g.items} systemFixedLabel={t('system_fixed')} />
          ))}
        </div>
      </div>
    </div>
  )
}
