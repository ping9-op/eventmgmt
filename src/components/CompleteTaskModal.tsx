import { useEffect, useState } from 'react'
import type { SalesTask } from '../types/database'
import { loadAllSettings, DEFAULTS } from '../lib/settings'
import { STAGE_ORDER } from '../lib/utils'
import { ACTIVITY_RESULTS, TASK_TYPES, completeTask, contactMethodForTask, daysFromToday } from '../lib/tasks'
import { useToast } from '../contexts/ToastContext'
import RadioGroup from './RadioGroup'
import LostReasonModal, { type LostReasonInput } from './LostReasonModal'

/**
 * 할 일 완료 창 — 결과 기록 + 단계 변경 + 다음 할 일을 한 번에
 * 리드 상세·팔로우업·대시보드에서 같은 창을 쓴다
 */
export default function CompleteTaskModal({ task, leadStage, companyName, onClose, onDone }: {
  task: SalesTask
  leadStage: string
  companyName?: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [methods, setMethods] = useState<string[]>(DEFAULTS.contact_methods)
  const [record, setRecord] = useState(true)
  const [actType, setActType] = useState(contactMethodForTask(task.task_type, DEFAULTS.contact_methods))
  const [actResult, setActResult] = useState('')
  const [actNote, setActNote] = useState('')
  const [stage, setStage] = useState(leadStage)
  const [noNext, setNoNext] = useState(false)
  const [nextTitle, setNextTitle] = useState('')
  const [nextDue, setNextDue] = useState(daysFromToday(3))
  const [nextType, setNextType] = useState(TASK_TYPES.includes(task.task_type) ? task.task_type : 'Email')
  const [askLost, setAskLost] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAllSettings().then(s => {
      setMethods(s.contact_methods)
      setActType(contactMethodForTask(task.task_type, s.contact_methods))
    })
  }, [task.task_type])

  // Won/Lost로 끝나면 다음 할 일 기본값은 '없음'
  useEffect(() => { setNoNext(stage === 'Won' || stage === 'Lost') }, [stage])

  async function submit(lost?: LostReasonInput) {
    if (record && !actResult) { showToast('⚠️ 결과를 선택해주세요.'); return }
    if (!noNext && !nextTitle.trim()) { showToast("⚠️ 다음 할 일을 입력하거나 '다음 할 일 없음'을 체크해주세요."); return }
    if (stage === 'Lost' && stage !== leadStage && !lost) { setAskLost(true); return }
    setSaving(true)
    try {
      await completeTask({
        taskId: task.id,
        leadId: task.lead_id,
        activity: record ? { type: actType, result: actResult, note: actNote } : undefined,
        stage: { from: leadStage, to: stage, lost },
        next: noNext ? undefined : { title: nextTitle, type: nextType, due: nextDue },
      })
      showToast('✅ 완료 처리되었습니다.')
      onDone()
    } catch (err: any) {
      showToast('⚠️ 완료 처리 실패: ' + (err?.message || '알 수 없는 오류'))
    } finally {
      setSaving(false)
    }
  }

  const sub = { fontSize: 13, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text)' } as const
  return (
    <>
      <div className="modal-bg open" style={{ zIndex: 10000 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="modal" style={{ maxWidth: 520, width: '95vw' }}>
          <div className="modal-hdr">
            <h3>✅ 할 일 완료{companyName ? ` — ${companyName}` : ''}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--light)', borderRadius: 8, fontSize: 13 }}>
            <b>{task.task_title}</b> <span style={{ color: 'var(--muted)' }}>· {task.task_type} · {task.due_date}</span>
          </div>

          <div style={sub}>1. 어떻게 됐나요?</div>
          {record ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, alignItems: 'start' }}>
                <select value={actType} onChange={e => setActType(e.target.value)}>
                  {methods.map(m => <option key={m}>{m}</option>)}
                </select>
                <RadioGroup value={actResult} onChange={setActResult} options={ACTIVITY_RESULTS.map(r => ({ value: r, label: r }))} />
              </div>
              <textarea value={actNote} rows={2} onChange={e => setActNote(e.target.value)} placeholder="통화·미팅 내용 메모 (선택)"
                style={{ width: '100%', marginTop: 8, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </>
          ) : null}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!record} onChange={e => setRecord(!e.target.checked)} style={{ width: 14, height: 14 }} />
            연락 기록 없이 완료만
          </label>

          <div style={sub}>2. 단계 <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 12 }}>(현재: {leadStage})</span></div>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            {STAGE_ORDER.map(s => <option key={s} value={s}>{s === leadStage ? `${s} (그대로)` : s}</option>)}
          </select>

          <div style={sub}>3. 다음 할 일</div>
          {!noNext && (
            <>
              <input value={nextTitle} onChange={e => setNextTitle(e.target.value)} placeholder="무엇을? 예: 견적서 보내기, 2차 통화" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <select value={nextType} onChange={e => setNextType(e.target.value)}>
                  {TASK_TYPES.map(tp => <option key={tp}>{tp}</option>)}
                </select>
                <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {[['내일', 1], ['3일 뒤', 3], ['1주 뒤', 7], ['2주 뒤', 14]].map(([lbl, n]) => (
                  <button key={lbl} type="button" onClick={() => setNextDue(daysFromToday(n as number))}
                    style={{ padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border2)', background: nextDue === daysFromToday(n as number) ? 'var(--accent)' : 'white', color: nextDue === daysFromToday(n as number) ? 'white' : 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={noNext} onChange={e => setNoNext(e.target.checked)} style={{ width: 14, height: 14 }} />
            다음 할 일 없음
          </label>

          <div className="modal-footer">
            <button className="btn btn-muted" onClick={onClose}>취소</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => submit()}>{saving ? '저장 중...' : '완료 저장'}</button>
          </div>
        </div>
      </div>
      {askLost && (
        <LostReasonModal onCancel={() => setAskLost(false)}
          onConfirm={async v => { setAskLost(false); await submit(v) }} />
      )}
    </>
  )
}
