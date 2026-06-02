import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { krw, exhColor, formatEventDate, isPastEvent, exhDisplayName } from '../../lib/utils'
import type { Exhibition, Proposal, BudgetItem } from '../../types/database'
import { useLang } from '../../contexts/LangContext'
import { useToast } from '../../contexts/ToastContext'

interface ExhEntry {
  key: string; name: string; year: number
  date: string; venue: string; total: number; recurring: boolean
  proposal_date: string; author: string
}

interface ModalState {
  open: boolean
  entry?: ExhEntry
  isNew: boolean
}

export default function Schedule() {
  const navigate = useNavigate()
  const { t } = useLang()
  const { showToast } = useToast()
  const [entries, setEntries] = useState<ExhEntry[]>([])
  const [exhMap, setExhMap] = useState<Record<string, Exhibition>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ open: false, isNew: false })
  const [form, setForm] = useState<Partial<ExhEntry>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  async function load() {
    const [{ data: exhData, error: ee }, { data: propData, error: pe }] = await Promise.all([
      supabase.from('exhibitions').select('*'),
      supabase.from('proposals').select('*').order('year'),
    ])
    if (ee || pe) { showToast('⚠️ 데이터 로드 실패'); setLoading(false); return }
    const map: Record<string, Exhibition> = {}
    for (const e of (exhData || [])) map[e.id] = e
    setExhMap(map)

    const list: ExhEntry[] = ((propData || []) as unknown as Proposal[]).map(p => {
      const exh = map[p.exhibition_id]
      const budget = (p.budget as BudgetItem[]) || []
      return {
        key: exh?.key || '', name: exh?.name || '', year: p.year,
        date: p.date_of_event, venue: p.venue,
        total: budget.reduce((s, b) => s + b.curr, 0),
        recurring: exh?.recurring || false,
        proposal_date: p.proposal_date, author: p.author
      }
    })
    setEntries(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm({ year: new Date().getFullYear() + 1, author: '' })
    setModal({ open: true, isNew: true })
  }

  function openEdit(e: ExhEntry) {
    setForm({ ...e })
    setModal({ open: true, isNew: false, entry: e })
  }

  async function save() {
    if (!form.name || !form.year) return
    setSaving(true)
    try {
      let exhId: string
      const existing = Object.values(exhMap).find(e => e.name === form.name)
      if (existing) {
        exhId = existing.id
      } else {
        const { data, error } = await supabase.from('exhibitions').insert({
          key: form.name.replace(/[^a-zA-Z]/g, '').substring(0, 10),
          name: form.name,
          recurring: form.recurring || false,
        }).select().single()
        if (error) throw error
        exhId = data!.id
      }

      if (modal.isNew) {
        const { error } = await supabase.from('proposals').insert({
          exhibition_id: exhId,
          year: form.year!,
          proposal_date: form.proposal_date || new Date().toISOString().split('T')[0],
          author: form.author || '',
          date_of_event: form.date || '',
          venue: form.venue || '',
          objective: '',
          products: [],
          expected_results: [],
          budget: [],
          explanations: {}
        })
        if (error) throw error
      } else if (modal.entry) {
        const exhEntry = Object.values(exhMap).find(e => e.key === modal.entry!.key)
        if (exhEntry) {
          const { data: propData, error: findErr } = await supabase.from('proposals')
            .select('id').eq('exhibition_id', exhEntry.id).eq('year', modal.entry.year).single()
          if (findErr) throw findErr
          if (propData) {
            const { error } = await supabase.from('proposals').update({
              date_of_event: form.date || '',
              venue: form.venue || '',
              year: form.year!,
              proposal_date: form.proposal_date || '',
              author: form.author || '',
            }).eq('id', propData.id)
            if (error) throw error
          }
        }
      }

      setModal({ open: false, isNew: false }); setConfirmDel(false)
      load()
    } catch (err: any) {
      showToast('⚠️ 저장 실패: ' + (err?.message || '알 수 없는 오류'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(key: string, year: number) {
    const exh = Object.values(exhMap).find(e => e.key === key)
    if (!exh) return
    const { error } = await supabase.from('proposals').delete().eq('exhibition_id', exh.id).eq('year', year)
    if (error) { showToast('⚠️ 삭제 실패: ' + error.message); return }
    load()
  }

  const yearGroups: Record<number, ExhEntry[]> = {}
  for (const e of entries) {
    if (!yearGroups[e.year]) yearGroups[e.year] = []
    yearGroups[e.year].push(e)
  }

  // key별 proposal 연도 수 (2개 이상 = 기존, 1개 = 신규)
  const countByKey: Record<string, number> = {}
  for (const e of entries) countByKey[e.key] = (countByKey[e.key] || 0) + 1

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">{t('sched_title')}</div>
          <div className="sub">{t('sched_sub')}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>{t('add_schedule')}</button>
      </div>

      {Object.entries(yearGroups).sort((a, b) => Number(b[0]) - Number(a[0])).map(([year, yEntries]) => {
        const doneCount = yEntries.filter(e => isPastEvent(e.date, e.year)).length
        const schedCount = yEntries.length - doneCount
        const yearTotal = yEntries.reduce((s, e) => s + e.total, 0)
        return (
          <div key={year} className="yr-section" style={{ marginTop: 28 }}>
            <div className="yr-header">
              <div className="yr-num">{year}</div>
              <span className="badge" style={{ background: doneCount === yEntries.length ? '#7B8AA0' : 'var(--accent)', fontSize: 12 }}>
                {doneCount === yEntries.length ? t('badge_all_done') : `${schedCount}${t('unit_scheduled')}`}
              </span>
              <div className="yr-meta">{yEntries.length}{t('unit_exh')} &nbsp;·&nbsp; {krw(yearTotal)}</div>
            </div>
            <table className="rank-table">
              <thead>
                <tr>
                  <th>{t('col_exh')}</th><th>{t('event_period')} <span style={{ opacity: .7, fontSize: 10 }}>✎</span></th>
                  <th>{t('venue')} <span style={{ opacity: .7, fontSize: 10 }}>✎</span></th>
                  <th>{t('col_type')}</th><th>{t('sched_col_status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('col_budget_short')} <span style={{ opacity: .7, fontSize: 10 }}>✎</span></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {yEntries.map(e => {
                  const past = isPastEvent(e.date, e.year)
                  const color = exhColor(e.name)
                  return (
                    <tr key={`${e.key}_${e.year}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 5, height: 20, background: color, borderRadius: 3, flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, color, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                            onClick={() => navigate(`/expo/event/${e.key}/${e.year}`)}
                            title={`${e.name} ${e.year} 이벤트 상세 보기`}>
                            {exhDisplayName(e.name, e.key)} {e.year}
                          </span>
                        </div>
                      </td>
                      <td style={{ cursor: 'pointer' }} onClick={() => openEdit(e)}>{formatEventDate(e.date, e.year)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }} onClick={() => openEdit(e)}>{e.venue}</td>
                      <td>
                        <span className="badge" style={{ background: (countByKey[e.key] || 1) >= 2 ? '#2E7D51' : 'var(--amber)' }}>
                          {(countByKey[e.key] || 1) >= 2 ? t('badge_existing') : t('badge_new')}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: past ? '#7B8AA0' : 'var(--accent)' }}>
                          {past ? t('badge_done') : t('badge_scheduled')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color, cursor: 'pointer' }} onClick={() => openEdit(e)}>{krw(e.total)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>{t('edit')}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {modal.open && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-hdr">
              <h3>{modal.isNew ? t('sched_add_title') : t('sched_edit_title')}</h3>
              <button className="modal-close" onClick={() => { setModal({ open: false, isNew: false }); setConfirmDel(false) }}>✕</button>
            </div>
            <label>{t('exh_name_lbl')}</label>
            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Korea Import Fair (KIF)" />
            <div className="form-row cols3" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginTop: 0 }}>{t('year_label')}</label>
                <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('author_label')}</label>
                <input value={form.author || ''} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('write_date')}</label>
                <input type="date" value={form.proposal_date || ''} onChange={e => setForm(f => ({ ...f, proposal_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-row cols2" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginTop: 0 }}>{t('event_period')}</label>
                <input value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} placeholder="2027 Jun 23-25" />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('venue')}</label>
                <input value={form.venue || ''} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder={t('venue_placeholder')} />
              </div>
            </div>
            <label style={{ marginTop: 14 }}>{t('col_type')}</label>
            <select value={form.recurring ? '1' : '0'} onChange={e => setForm(f => ({ ...f, recurring: e.target.value === '1' }))}>
              <option value="1">{t('existing_exh')}</option>
              <option value="0">{t('new_exh')}</option>
            </select>
            {!modal.isNew && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#FFF0F0', borderRadius: 8, border: '1px solid #F5C6C6' }}>
                <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 8 }}>{t('delete_sched_warn')}</div>
                {confirmDel ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>{t('confirm_delete')}</span>
                    <button className="btn btn-sm" style={{ background: '#D63031', color: 'white', border: 'none' }}
                      onClick={async () => {
                        if (!modal.entry) return
                        await deleteEntry(modal.entry.key, modal.entry.year)
                        setModal({ open: false, isNew: false }); setConfirmDel(false)
                      }}>{t('delete')}</button>
                    <button className="btn btn-muted btn-sm" onClick={() => setConfirmDel(false)}>{t('cancel')}</button>
                  </div>
                ) : (
                  <button className="btn btn-sm" style={{ background: '#D63031', color: 'white', border: 'none' }}
                    onClick={() => setConfirmDel(true)}>
                    {t('delete_sched_btn')}
                  </button>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => { setModal({ open: false, isNew: false }); setConfirmDel(false) }}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
