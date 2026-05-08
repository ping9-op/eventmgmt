import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { priorityColor } from '../../lib/utils'
import type { SalesTask, SalesLead } from '../../types/database'
import { loadSalesSettings } from '../../lib/settings'
import { useToast } from '../../contexts/ToastContext'

const TASK_TYPES = ['Email','Call','SMS','Meeting','Send Proposal','Request Docs','Other']
const PRIORITIES = ['High','Medium','Low']
const STATUSES = ['Pending','In Progress','Done']

const STATUS_COLORS: Record<string, string> = {
  'Done': '#2E7D51',
  'In Progress': '#C47D1A',
  'Pending': '#7B8AA0',
}

function TaskForm({
  data,
  onChange,
  leads,
  showStatus,
  owners,
}: {
  data: Partial<SalesTask>
  onChange: (d: Partial<SalesTask>) => void
  leads: SalesLead[]
  showStatus?: boolean
  owners: string[]
}) {
  return (
    <>
      <label style={{ marginTop: 0 }}>Lead 선택</label>
      <select value={data.lead_id || ''} onChange={e => onChange({ ...data, lead_id: e.target.value })}>
        <option value="">-- Lead 선택 --</option>
        {leads.map(l => <option key={l.id} value={l.id}>{l.company_name} ({l.contact_person})</option>)}
      </select>
      <label>Task 제목</label>
      <input value={data.task_title || ''} onChange={e => onChange({ ...data, task_title: e.target.value })} />
      <div className="form-row cols3">
        <div>
          <label>타입</label>
          <select value={data.task_type || 'Call'} onChange={e => onChange({ ...data, task_type: e.target.value })}>
            {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label>마감일</label>
          <input type="date" value={data.due_date || ''} onChange={e => onChange({ ...data, due_date: e.target.value })} />
        </div>
        <div>
          <label>우선순위</label>
          <select value={data.priority || 'Medium'} onChange={e => onChange({ ...data, priority: e.target.value })}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row cols2">
        <div>
          <label>담당자</label>
          <select value={data.owner || 'Andrew'} onChange={e => onChange({ ...data, owner: e.target.value })}>
            {owners.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        {showStatus && (
          <div>
            <label>상태</label>
            <select value={data.status || 'Pending'} onChange={e => onChange({ ...data, status: e.target.value })}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>
      <label>메모</label>
      <input value={data.note || ''} onChange={e => onChange({ ...data, note: e.target.value })} />
    </>
  )
}

export default function SalesFollowUp() {
  const { showToast } = useToast()
  const { owners: OWNERS } = loadSalesSettings()
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState<SalesTask | null>(null)
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming'>('all')
  const [filterOwner, setFilterOwner] = useState('')
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<Partial<SalesTask>>({
    task_type: 'Call', priority: 'Medium', owner: 'Andrew',
    status: 'Pending', due_date: today,
  })

  async function load() {
    const [{ data: taskData }, { data: leadData }] = await Promise.all([
      supabase.from('sales_tasks').select('*').order('due_date'),
      supabase.from('sales_leads').select('id, company_name, contact_person').order('company_name'),
    ])
    setTasks((taskData || []) as SalesTask[])
    setLeads((leadData || []) as SalesLead[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addTask() {
    await supabase.from('sales_tasks').insert({
      lead_id: form.lead_id || leads[0]?.id || '',
      task_title: form.task_title || '',
      task_type: form.task_type || 'Call',
      due_date: form.due_date || today,
      status: 'Pending',
      priority: form.priority || 'Medium',
      owner: form.owner || 'Andrew',
      note: form.note || null,
      completed_at: null,
    })
    setShowAdd(false)
    setForm({ task_type: 'Call', priority: 'Medium', owner: 'Andrew', status: 'Pending', due_date: today })
    showToast('Task가 추가되었습니다.')
    load()
  }

  async function saveEdit() {
    if (!editTask) return
    const completed_at =
      editTask.status === 'Done'
        ? (editTask.completed_at || new Date().toISOString())
        : null
    await supabase.from('sales_tasks').update({
      lead_id: editTask.lead_id,
      task_title: editTask.task_title,
      task_type: editTask.task_type,
      due_date: editTask.due_date,
      priority: editTask.priority,
      owner: editTask.owner,
      status: editTask.status,
      note: editTask.note,
      completed_at,
    }).eq('id', editTask.id)
    setEditTask(null)
    showToast('Task가 수정되었습니다.')
    load()
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm('이 Task를 삭제하시겠습니까?')) return
    await supabase.from('sales_tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function setStatus(taskId: string, status: string) {
    const completed_at = status === 'Done' ? new Date().toISOString() : null
    await supabase.from('sales_tasks').update({ status, completed_at }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, completed_at } : t))
  }

  const filtered = tasks.filter(t => {
    if (filterOwner && t.owner !== filterOwner) return false
    if (filter === 'today') return t.due_date === today && t.status !== 'Done'
    if (filter === 'overdue') return t.due_date < today && t.status !== 'Done'
    if (filter === 'upcoming') return t.due_date > today
    return true
  })

  const overdue = tasks.filter(t => t.due_date < today && t.status !== 'Done').length
  const todayCount = tasks.filter(t => t.due_date === today && t.status !== 'Done').length

  const leadMap: Record<string, SalesLead> = {}
  for (const l of leads) leadMap[l.id] = l

  if (loading) return <div className="view wide"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  return (
    <div className="view wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">Follow-up 관리</div>
          <div className="sub">{filtered.length}건</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Task 추가</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { key: 'all', label: '전체' },
          { key: 'overdue', label: `기한 초과 (${overdue})`, danger: overdue > 0 },
          { key: 'today', label: `오늘 (${todayCount})` },
          { key: 'upcoming', label: '예정' },
        ].map(f => (
          <button key={f.key}
            className={`btn btn-sm${filter === f.key ? ' btn-primary' : ' btn-outline'}`}
            style={f.danger && filter !== f.key ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}
            onClick={() => setFilter(f.key as any)}
          >{f.label}</button>
        ))}
        <select
          value={filterOwner}
          onChange={e => setFilterOwner(e.target.value)}
          style={{ marginLeft: 'auto', width: 130 }}
        >
          <option value="">전체 담당자</option>
          {OWNERS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>

      <table className="sales-table">
        <thead>
          <tr>
            <th>Task</th><th>타입</th><th>회사명</th><th>마감일</th>
            <th>우선순위</th><th>담당자</th><th>상태</th><th>메모</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(t => {
            const isOverdue = t.due_date < today && t.status !== 'Done'
            const lead = leadMap[t.lead_id]
            return (
              <tr key={t.id} style={t.status === 'Done' ? { opacity: 0.5 } : {}}>
                <td style={{ fontWeight: 600 }}>{t.task_title}</td>
                <td>
                  <span style={{ background: 'var(--light)', fontSize: 12, padding: '2px 8px', borderRadius: 99 }}>{t.task_type}</span>
                </td>
                <td style={{ fontSize: 13 }}>{lead?.company_name || '-'}</td>
                <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text)', fontWeight: isOverdue ? 700 : 400 }}>
                  {t.due_date}{isOverdue && ' ⚠'}
                </td>
                <td style={{ color: priorityColor(t.priority), fontWeight: 700 }}>{t.priority}</td>
                <td>{t.owner}</td>
                <td>
                  <span style={{
                    background: STATUS_COLORS[t.status] || '#7B8AA0',
                    color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                  }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{t.note || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {t.status === 'Pending' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#C47D1A', color: 'white', border: 'none' }}
                        onClick={() => setStatus(t.id, 'In Progress')}
                      >진행</button>
                    )}
                    {t.status === 'In Progress' && (
                      <button className="btn btn-sm btn-green" onClick={() => setStatus(t.id, 'Done')}>완료</button>
                    )}
                    {t.status === 'Pending' && (
                      <button className="btn btn-sm btn-green" onClick={() => setStatus(t.id, 'Done')}>완료</button>
                    )}
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setEditTask(t)}
                    >수정</button>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      onClick={() => deleteTask(t.id)}
                    >삭제</button>
                  </div>
                </td>
              </tr>
            )
          })}
          {filtered.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>해당하는 Task가 없습니다</td></tr>
          )}
        </tbody>
      </table>

      {/* Add modal */}
      {showAdd && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-hdr">
              <h3>Task 추가</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <TaskForm data={form} onChange={setForm} leads={leads} owners={OWNERS} />
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setShowAdd(false)}>취소</button>
              <button className="btn btn-primary" onClick={addTask} disabled={!form.task_title}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTask && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-hdr">
              <h3>Task 수정</h3>
              <button className="modal-close" onClick={() => setEditTask(null)}>✕</button>
            </div>
            <TaskForm
              data={editTask}
              onChange={d => setEditTask(d as SalesTask)}
              leads={leads}
              showStatus
              owners={OWNERS}
            />
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setEditTask(null)}>취소</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={!editTask.task_title}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
