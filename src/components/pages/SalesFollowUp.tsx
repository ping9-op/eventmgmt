import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_COLORS, priorityColor } from '../../lib/utils'
import type { SalesTask, SalesLead } from '../../types/database'
import { loadSalesSettings } from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'
import LeadDetailPanel from './LeadDetailPanel'
import { useLang } from '../../contexts/LangContext'

const TASK_TYPES = ['Email', 'Call', 'SMS', 'Meeting', 'Send Proposal', 'Request Docs', 'Other']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUSES = ['Pending', 'In Progress', 'Done']

// DB에 한국어로 저장된 task_type 영어 매핑
const TASK_TYPE_MAP: Record<string, string> = {
  '이메일': 'Email', '전화': 'Call', '문자': 'SMS', '카카오': 'KakaoTalk',
  '미팅': 'Meeting', '미팅 준비': 'Meeting Prep', '서류': 'Request Docs',
  '제안서': 'Send Proposal', '기타': 'Other',
}
function taskTypeEn(type: string): string {
  return TASK_TYPE_MAP[type] || type
}

type TaskFilter = 'today' | 'week' | 'overdue' | 'done' | null

function PriorityBadge({ p }: { p: string }) {
  const col = p === 'High' ? '#DC2626' : p === 'Medium' ? '#D97706' : '#6B7280'
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, color: 'white', background: col }}>{p}</span>
}

function StatusBadge({ s }: { s: string }) {
  const col = s === 'Done' ? '#2E7D51' : s === 'Overdue' ? '#DC2626' : '#D97706'
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: col }}>{s}</span>
}

export default function SalesFollowUp() {
  const { t, lang } = useLang()
  const location = useLocation()
  const { showToast } = useToast()
  const settings = loadSalesSettings()
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [loading, setLoading] = useState(true)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().split('T')[0]
  const thisWeekEnd = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  // Add task form
  const [form, setForm] = useState({
    lead_id: '', task_title: '', task_type: 'Email', due_date: today,
    status: 'Pending', priority: 'Medium', owner: settings.owners[0] || '', note: '',
  })

  useEffect(() => {
    let cancelled = false
    const state = (location.state as any)
    if (state?.filter) setTaskFilter(state.filter as TaskFilter)
    async function load() {
      try {
        const [{ data: taskData, error: te }, { data: leadData, error: le }] = await Promise.all([
          supabase.from('sales_tasks').select('*').order('due_date'),
          supabase.from('sales_leads').select('*'),
        ])
        if (cancelled) return
        if (te) throw te
        if (le) throw le
        const rawTasks = (taskData || []) as SalesTask[]
        const processedTasks = rawTasks.map(t => {
          if (t.status === 'Done') return t
          if (t.due_date < today) return { ...t, status: 'Overdue' }
          if (t.status === 'Overdue') return { ...t, status: 'Pending' }
          return t
        })
        if (!cancelled) setTasks(processedTasks)
        if (!cancelled) setLeads((leadData || []) as SalesLead[])
      } catch (err: any) {
        if (!cancelled) showToast('⚠️ 데이터 로드 실패: ' + (err?.message || '알 수 없는 오류'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function load() {
    try {
      const [{ data: taskData, error: te }, { data: leadData, error: le }] = await Promise.all([
        supabase.from('sales_tasks').select('*').order('due_date'),
        supabase.from('sales_leads').select('*'),
      ])
      if (te) throw te
      if (le) throw le
      const rawTasks = (taskData || []) as SalesTask[]
      const processedTasks = rawTasks.map(t => {
        if (t.status === 'Done') return t
        if (t.due_date < today) return { ...t, status: 'Overdue' }
        if (t.status === 'Overdue') return { ...t, status: 'Pending' }
        return t
      })
      setTasks(processedTasks)
      setLeads((leadData || []) as SalesLead[])
    } catch (err: any) {
      showToast('⚠️ 데이터 로드 실패: ' + (err?.message || '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  async function markDone(taskId: string) {
    const { error } = await supabase.from('sales_tasks').update({ status: 'Done', completed_at: today }).eq('id', taskId)
    if (error) { showToast('⚠️ 업데이트 실패: ' + error.message); return }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Done', completed_at: today } : t))
    showToast('Task 완료!')
  }

  async function deleteTask(taskId: string) {
    const { error } = await supabase.from('sales_tasks').delete().eq('id', taskId)
    if (error) { showToast('⚠️ 삭제 실패: ' + error.message); return }
    setTasks(prev => prev.filter(t => t.id !== taskId))
    showToast('🗑️ Task가 삭제되었습니다.')
  }

  async function bulkMarkDone() {
    if (checked.size === 0) return
    const ids = Array.from(checked)
    const { error } = await supabase.from('sales_tasks').update({ status: 'Done', completed_at: today }).in('id', ids)
    if (error) { showToast('⚠️ 일괄 완료 실패: ' + error.message); return }
    setTasks(prev => prev.map(t => checked.has(t.id) ? { ...t, status: 'Done', completed_at: today } : t))
    setChecked(new Set())
    showToast(`✅ ${ids.length}개 Task 완료 처리되었습니다.`)
  }

  async function bulkDelete() {
    if (checked.size === 0) return
    const ids = Array.from(checked)
    const { error } = await supabase.from('sales_tasks').delete().in('id', ids)
    if (error) { showToast('⚠️ 일괄 삭제 실패: ' + error.message); return }
    setTasks(prev => prev.filter(t => !checked.has(t.id)))
    setChecked(new Set())
    showToast(`🗑️ ${ids.length}개 Task가 삭제되었습니다.`)
  }

  async function addTask() {
    if (!form.lead_id || !form.task_title) { showToast('⚠️ Lead와 Task 제목은 필수입니다.'); return }
    const { error } = await supabase.from('sales_tasks').insert({
      lead_id: form.lead_id, task_title: form.task_title, task_type: form.task_type,
      due_date: form.due_date, status: form.status, priority: form.priority,
      owner: form.owner, note: form.note || null,
    })
    if (error) { showToast('⚠️ Task 추가 실패: ' + error.message); return }
    setShowAddTask(false)
    setForm({ lead_id: '', task_title: '', task_type: 'Email', due_date: today, status: 'Pending', priority: 'Medium', owner: settings.owners[0] || '', note: '' })
    showToast('Task가 추가되었습니다.')
    load()
  }

  function toggleCheck(id: string, all?: string[]) {
    if (all) {
      const allChecked = all.every(i => checked.has(i))
      setChecked(prev => { const n = new Set(prev); all.forEach(i => allChecked ? n.delete(i) : n.add(i)); return n })
    } else {
      setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
  }

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  const todayCnt = tasks.filter(t => t.due_date === today && t.status !== 'Done').length
  const weekCnt = tasks.filter(t => t.due_date > today && t.due_date <= thisWeekEnd && t.status !== 'Done').length
  const overdueCnt = tasks.filter(t => t.status === 'Overdue').length
  const doneTodayCnt = tasks.filter(t => t.status === 'Done' && t.completed_at === today).length

  const filterCards = [
    { lbl: t('s_today'), val: todayCnt, col: '#D97706', bg: '#FFFBEB', filter: 'today' as TaskFilter },
    { lbl: t('s_this_week'), val: weekCnt, col: '#4F46E5', bg: '#EEF2FF', filter: 'week' as TaskFilter },
    { lbl: t('s_overdue_card'), val: overdueCnt, col: '#DC2626', bg: '#FEF2F2', filter: 'overdue' as TaskFilter },
    { lbl: t('s_done_today'), val: doneTodayCnt, col: '#059669', bg: '#ECFDF5', filter: 'done' as TaskFilter },
  ]

  let shown = tasks
  if (taskFilter === 'today') shown = tasks.filter(t => t.due_date === today && t.status !== 'Done')
  else if (taskFilter === 'week') shown = tasks.filter(t => t.due_date > today && t.due_date <= thisWeekEnd && t.status !== 'Done')
  else if (taskFilter === 'overdue') shown = tasks.filter(t => t.status === 'Overdue')
  else if (taskFilter === 'done') shown = tasks.filter(t => t.status === 'Done')

  const leadMap: Record<string, SalesLead> = {}
  for (const l of leads) leadMap[l.id] = l

  const allIds = shown.map(t => t.id)

  return (
    <div className="view wide">
      <div className="page-hdr-row">
        <div className="sec-hdr">
          <div className="bar" />
          <div className="txt">{t('s_followup_title')}</div>
          <div className="sub">{t('s_followup_sub')}</div>
        </div>
        <div className="page-hdr-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(true)}>{t('add_task_title')}</button>
        </div>
      </div>

      {/* 필터 카드 4개 */}
      <div className="g4" style={{ gap: 14, marginBottom: 20, marginTop: 16 }}>
        {filterCards.map(k => {
          const active = taskFilter === k.filter
          return (
            <div key={k.filter} onClick={() => setTaskFilter(active ? null : k.filter)}
              style={{ background: active ? k.col : k.bg, border: `2px solid ${active ? k.col : k.col + '30'}`, borderRadius: 12, padding: '16px 18px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s', userSelect: 'none' }}
              onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,.1)' }}
              onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}>
              <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,.8)' : k.col, fontWeight: 600, marginBottom: 6 }}>{k.lbl}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: active ? 'white' : k.col }}>{k.val}</div>
            </div>
          )
        })}
      </div>

      {/* 필터 배지 */}
      {taskFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#FFF8F0', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>🔍 필터: <strong>{filterCards.find(c => c.filter === taskFilter)?.lbl}</strong> ({shown.length}개)</span>
          <button onClick={() => setTaskFilter(null)} style={{ padding: '3px 10px', borderRadius: 5, background: 'white', border: '1px solid var(--border2)', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>{t('clear_filter')}</button>
        </div>
      )}

      {/* 테이블 */}
      <div style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
        {/* 액션 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: '#FAFAFA', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={allIds.length > 0 && allIds.every(i => checked.has(i))} onChange={() => toggleCheck('', allIds)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            {t('select_all')}
          </label>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, minWidth: 70 }}>{checked.size > 0 ? `${checked.size}개 선택됨` : ''}</span>
          {checked.size > 0 && (
            <>
              <button onClick={bulkMarkDone} style={{ padding: '4px 12px', borderRadius: 6, background: '#059669', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>✅ 일괄 완료</button>
              <button onClick={bulkDelete} style={{ padding: '4px 12px', borderRadius: 6, background: '#FFF0F0', color: '#DC2626', border: '1px solid #FFC5C5', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>🗑️ 일괄 삭제</button>
            </>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--accent)', color: 'white' }}>
                <th style={{ padding: '9px 10px', width: 38 }}><input type="checkbox" style={{ width: 15, height: 15, cursor: 'pointer' }} /></th>
                <th style={{ padding: '9px 14px', textAlign: 'left' }}>Due Date</th>
                <th style={{ padding: '9px 14px' }}>Company</th>
                <th style={{ padding: '9px 14px' }}>Contact</th>
                <th style={{ padding: '9px 14px' }}>Stage</th>
                <th style={{ padding: '9px 14px' }}>Task Type</th>
                <th style={{ padding: '9px 14px' }}>Next Action</th>
                <th style={{ padding: '9px 14px' }}>Owner</th>
                <th style={{ padding: '9px 14px' }}>Priority</th>
                <th style={{ padding: '9px 14px' }}>Status</th>
                <th style={{ padding: '9px 14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {shown.sort((a, b) => a.due_date.localeCompare(b.due_date)).map(task => {
                const lead = leadMap[task.lead_id]
                const isOv = task.status === 'Overdue'
                const stageBg = STAGE_COLORS[lead?.current_stage || '']?.bg
                return (
                  <tr key={task.id} style={{ borderBottom: '0.5px solid var(--border)', background: isOv ? '#FEF2F230' : '' }}
                    onMouseOver={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = '#FDF5F5'))}
                    onMouseOut={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(td => (td.style.background = isOv ? '#FEF2F230' : ''))}>
                    <td style={{ padding: '9px 10px', textAlign: 'center' }} onClick={() => toggleCheck(task.id)}>
                      <input type="checkbox" checked={checked.has(task.id)} onChange={() => toggleCheck(task.id)} style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: isOv ? '#DC2626' : 'var(--text)' }}>{task.due_date}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                      onClick={() => lead && setSelectedLeadId(lead.id)}>
                      {lead?.company_name || '—'}
                    </td>
                    <td style={{ padding: '9px 14px' }}>{lead?.contact_person || '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      {lead?.current_stage && stageBg
                        ? <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'white', background: stageBg }}>{lead.current_stage}</span>
                        : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12 }}>{lang === 'en' ? taskTypeEn(task.task_type) : task.task_type}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.note || '—'}</td>
                    <td style={{ padding: '9px 14px' }}>{task.owner}</td>
                    <td style={{ padding: '9px 14px' }}><PriorityBadge p={task.priority} /></td>
                    <td style={{ padding: '9px 14px' }}><StatusBadge s={task.status} /></td>
                    <td style={{ padding: '9px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {task.status !== 'Done' && (
                          <button onClick={() => markDone(task.id)}
                            style={{ padding: '4px 10px', borderRadius: 6, background: '#059669', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', minHeight: 44 }}>
                            {t('mark_done')}
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.id)}
                          style={{ padding: '4px 8px', borderRadius: 6, background: '#FFF0F0', color: '#DC2626', border: '1px solid #FFC5C5', fontSize: 11, cursor: 'pointer', fontWeight: 600, minHeight: 44 }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {shown.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('no_tasks')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task 추가 모달 */}
      {showAddTask && (
        <div className="modal-bg open">
          <div className="modal" style={{ width: 520, maxWidth: '95vw' }}>
            <div className="modal-hdr">
              <h3>{t('add_task_title')}</h3>
              <button className="modal-close" onClick={() => setShowAddTask(false)}>✕</button>
            </div>
            <label style={{ marginTop: 0 }}>{t('s_leads_title')}</label>
            <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
              <option value="">{t('select_placeholder')}</option>
              {leads.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').map(l => (
                <option key={l.id} value={l.id}>{l.company_name} ({l.contact_person})</option>
              ))}
            </select>
            <label>{t('task_title_lbl')}</label>
            <input value={form.task_title} onChange={e => setForm(f => ({ ...f, task_title: e.target.value }))} />
            <div className="form-row cols3" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginTop: 0 }}>{t('task_type_lbl')}</label>
                <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}>
                  {TASK_TYPES.map(tp => <option key={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('task_due_lbl')}</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('task_priority_lbl')}</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row cols2" style={{ marginTop: 14 }}>
              <div>
                <label style={{ marginTop: 0 }}>Owner</label>
                <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}>
                  {settings.owners.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginTop: 0 }}>{t('status_lbl')}</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <label>{t('task_note_lbl')}</label>
            <textarea value={form.note} rows={2} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setShowAddTask(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={addTask}>+ {t('add')}</button>
            </div>
          </div>
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onRefresh={load} />
      )}
    </div>
  )
}
