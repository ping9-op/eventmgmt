import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TASK_TYPES, TASK_PLAYBOOK, playbookFor, loadPlaybook, daysFromToday, addLeadTask } from '../lib/tasks'
import { localDateStr } from '../lib/utils'

/**
 * 단계 변경 직후 팝업을 띄울 단계인지 (Won/Lost 제외)
 * 설정에서 그 단계의 자동 할 일을 꺼 두었으면 팝업이 열리자마자 스스로 닫힌다 (아래 useEffect)
 */
export const needsNextStep = (stage: string) => TASK_PLAYBOOK.some(p => p.stage === stage)

const QUICK_DUE = [{ label: '오늘', days: 0 }, { label: '내일', days: 1 }, { label: '3일 뒤', days: 3 }, { label: '1주 뒤', days: 7 }]

/**
 * 단계 변경 직후 "다음 할 일" 팝업
 * DB 트리거가 이미 그 단계의 기본 할 일을 만들어 두었으므로, 그 할 일을 불러와 보여주고
 * 저장 → 수정 내용 반영 / 할 일 안 만들기 → 그 할 일 종료 / 닫기 → 제안 그대로 유지
 */
export default function NextStepModal({ leadId, stage, companyName, onClose }: {
  leadId: string
  stage: string
  companyName?: string
  /** changed: 할 일을 수정·종료했으면 true (호출한 쪽에서 다시 불러오기) */
  onClose: (changed: boolean) => void
}) {
  const pb = playbookFor(stage)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [title, setTitle] = useState(pb?.title || '')
  const [type, setType] = useState('Call')
  const [due, setDue] = useState(daysFromToday(pb?.days ?? 3))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('sales_tasks').select('id, task_title, task_type, due_date')
        .eq('lead_id', leadId).eq('auto_stage', stage).neq('status', 'Done')
        .order('created_at', { ascending: false }).limit(1),
      loadPlaybook(),
    ]).then(([{ data }, book]) => {
      if (cancelled) return
      const t = data?.[0]
      // 설정에서 이 단계의 자동 할 일을 꺼 두었으면 제안할 것이 없으므로 닫는다
      if (!t && !playbookFor(stage, book)) { onClose(false); return }
      if (t) { setTaskId(t.id); setTitle(t.task_title || ''); setType(t.task_type || 'Call'); setDue(t.due_date || due) }
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, stage])

  async function save() {
    if (!title.trim() || !due) return
    setSaving(true); setError('')
    try {
      if (taskId) {
        const { error } = await supabase.from('sales_tasks')
          .update({ task_title: title.trim(), task_type: type, due_date: due }).eq('id', taskId)
        if (error) throw error
      } else {
        await addLeadTask(leadId, { title, type, due })
      }
      onClose(true)
    } catch (e: any) {
      setError(e?.message || '저장 실패'); setSaving(false)
    }
  }

  async function skip() {
    if (!taskId) { onClose(false); return }
    setSaving(true); setError('')
    const { error } = await supabase.from('sales_tasks')
      .update({ status: 'Done', completed_at: localDateStr() }).eq('id', taskId)
    if (error) { setError(error.message); setSaving(false); return }
    onClose(true)
  }

  return (
    <div className="modal-bg open" style={{ zIndex: 10000 }} onClick={e => { if (e.target === e.currentTarget) onClose(false) }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-hdr">
          <h3>➡️ {stage} — 다음 할 일</h3>
          <button className="modal-close" onClick={() => onClose(false)}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          {companyName ? <b style={{ color: 'var(--text)' }}>{companyName}</b> : '리드'}의 단계가 바뀌었습니다.
          {' '}아래 할 일이 팔로우업에 등록됩니다. 필요하면 고쳐서 저장하세요.
        </div>
        {loading ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>불러오는 중…</div> : (
          <>
            <label style={{ marginTop: 0 }}>할 일</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} />
            <label style={{ marginTop: 12 }}>유형</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {[...new Set([...TASK_TYPES, type])].map(x => <option key={x}>{x}</option>)}
            </select>
            <label style={{ marginTop: 12 }}>기한</label>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {QUICK_DUE.map(q => {
                const d = daysFromToday(q.days)
                return (
                  <button key={q.label} type="button" onClick={() => setDue(d)}
                    style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                      border: '1px solid ' + (due === d ? 'var(--accent)' : 'var(--border2)'),
                      background: due === d ? 'var(--accent-light)' : 'var(--card)',
                      color: due === d ? 'var(--accent)' : 'var(--text)', fontWeight: due === d ? 700 : 400,
                    }}>{q.label}</button>
                )
              })}
            </div>
          </>
        )}
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>⚠️ {error}</div>}
        <div className="modal-footer">
          <button className="btn btn-muted" onClick={skip} disabled={loading || saving}>할 일 안 만들기</button>
          <button className="btn btn-primary" onClick={save} disabled={loading || saving || !title.trim() || !due}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
