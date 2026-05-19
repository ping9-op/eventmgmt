import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { krw, exhColor, formatEventDate, isPastEvent } from '../../lib/utils'
import type { Exhibition, Proposal, BudgetItem } from '../../types/database'

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
  const [entries, setEntries] = useState<ExhEntry[]>([])
  const [exhMap, setExhMap] = useState<Record<string, Exhibition>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalState>({ open: false, isNew: false })
  const [form, setForm] = useState<Partial<ExhEntry>>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: exhData }, { data: propData }] = await Promise.all([
      supabase.from('exhibitions').select('*'),
      supabase.from('proposals').select('*').order('year'),
    ])
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

    // Find or create exhibition
    let exhId: string
    const existing = Object.values(exhMap).find(e => e.name === form.name)
    if (existing) {
      exhId = existing.id
    } else {
      const { data } = await supabase.from('exhibitions').insert({
        key: form.name.replace(/[^a-zA-Z]/g, '').substring(0, 10),
        name: form.name,
        recurring: false,
      }).select().single()
      exhId = data!.id
    }

    if (modal.isNew) {
      await supabase.from('proposals').insert({
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
    } else if (modal.entry) {
      const exhEntry = Object.values(exhMap).find(e => e.key === modal.entry!.key)
      if (exhEntry) {
        const { data: propData } = await supabase.from('proposals')
          .select('id').eq('exhibition_id', exhEntry.id).eq('year', modal.entry.year).single()
        if (propData) {
          await supabase.from('proposals').update({
            date_of_event: form.date || '',
            venue: form.venue || '',
            year: form.year!,
            proposal_date: form.proposal_date || '',
            author: form.author || '',
          }).eq('id', propData.id)
        }
      }
    }

    setSaving(false)
    setModal({ open: false, isNew: false })
    load()
  }

  async function deleteEntry(key: string, year: number) {
    const exh = Object.values(exhMap).find(e => e.key === key)
    if (!exh) return
    await supabase.from('proposals').delete().eq('exhibition_id', exh.id).eq('year', year)
    load()
  }

  const yearGroups: Record<number, ExhEntry[]> = {}
  for (const e of entries) {
    if (!yearGroups[e.year]) yearGroups[e.year] = []
    yearGroups[e.year].push(e)
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">박람회 일정 관리</div>
          <div className="sub">연도별 전체 일정</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ 일정 추가</button>
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
                {doneCount === yEntries.length ? '전체 완료' : `예정 ${schedCount}개`}
              </span>
              <div className="yr-meta">{yEntries.length}개 박람회 &nbsp;·&nbsp; {krw(yearTotal)}</div>
            </div>
            <table className="rank-table">
              <thead>
                <tr>
                  <th>박람회명</th><th>행사 기간 <span style={{ opacity: .7, fontSize: 10 }}>✎</span></th>
                  <th>장소 <span style={{ opacity: .7, fontSize: 10 }}>✎</span></th>
                  <th>구분</th><th>상태</th>
                  <th style={{ textAlign: 'right' }}>총 예산 <span style={{ opacity: .7, fontSize: 10 }}>✎</span></th>
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
                            {e.name} {e.year}
                          </span>
                        </div>
                      </td>
                      <td style={{ cursor: 'pointer' }} onClick={() => openEdit(e)}>{formatEventDate(e.date, e.year)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }} onClick={() => openEdit(e)}>{e.venue}</td>
                      <td>
                        <span className="badge" style={{ background: e.recurring ? '#2E7D51' : 'var(--amber)' }}>
                          {e.recurring ? '기존' : '신규'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: past ? '#7B8AA0' : 'var(--accent)' }}>
                          {past ? '완료' : '예정'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color, cursor: 'pointer' }} onClick={() => openEdit(e)}>{krw(e.total)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>편집</button>
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
              <h3>{modal.isNew ? '일정 추가' : '일정 편집'}</h3>
              <button className="modal-close" onClick={() => setModal({ open: false, isNew: false })}>✕</button>
            </div>
            <label>박람회 이름</label>
            <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Korea Import Fair (KIF)" />
            <div className="form-row cols3" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginTop: 0 }}>연도</label>
                <input type="number" value={form.year || ''} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>작성자</label>
                <input value={form.author || ''} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Proposal 날짜</label>
                <input type="date" value={form.proposal_date || ''} onChange={e => setForm(f => ({ ...f, proposal_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-row cols2" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginTop: 0 }}>행사 기간</label>
                <input value={form.date || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} placeholder="2027 Jun 23-25" />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>장소</label>
                <input value={form.venue || ''} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} placeholder="COEX Hall B" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setModal({ open: false, isNew: false })}>취소</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
