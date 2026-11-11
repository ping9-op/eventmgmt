// 팔로우업(Task) 공용 — 리드관리·퍼널·팔로우업·대시보드가 같은 Task를 쓴다
// 리드의 next_action / next_follow_up_date는 DB 트리거가 미완료 Task 중 가장 빠른 것으로 채운다 (직접 저장하지 않음)
// Activity를 추가하면 DB 트리거가 리드의 last_contact_date / first_contact_done을 갱신한다
import { supabase } from './supabase'
import { encryptRows } from './pii'
import { localDateStr } from './utils'
import { logStageChange } from './stageHistory'
import type { LostReasonInput } from '../components/LostReasonModal'

export const TASK_TYPES = ['Email', 'Call', 'SMS', 'Meeting', 'Send Proposal', 'Request Docs', 'Other']
/**
 * 단계별 기본 할 일 — DB 트리거(sales_leads_auto_task)가 리드 등록·단계 변경 시 자동 배정
 * 여기 값은 화면 안내용이므로 바꿀 때는 supabase/migrations/20261111040000_auto_task_playbook.sql 과 함께 바꿀 것
 */
export const TASK_PLAYBOOK: { stage: string; title: string; days: number }[] = [
  { stage: 'New Lead', title: '첫 연락 (Cold Call / Cold Email)', days: 1 },
  { stage: 'Outreach Sent', title: '응답 확인 · 재연락', days: 3 },
  { stage: 'Engaged', title: '미팅 일정 잡기', days: 3 },
  { stage: 'Meeting Scheduled', title: '미팅 후 제안서 발송', days: 3 },
  { stage: 'Proposal Sent', title: '제안서 회신 확인', days: 3 },
  { stage: 'Onboarding', title: '온보딩 서류·진행 확인', days: 3 },
]
export const playbookFor = (stage: string) => TASK_PLAYBOOK.find(p => p.stage === stage)

export const ACTIVITY_RESULTS =['Interested', 'No Response', 'Not Interested', 'Requested Info', 'Scheduled Meeting']

/** Task 유형 → 완료 기록 시 기본 연락 방법 */
export function contactMethodForTask(taskType: string, methods: string[]): string {
  const map: Record<string, string> = { Email: 'Email', Call: 'Call', SMS: 'SMS', Meeting: 'Visit', '이메일': 'Email', '전화': 'Call', '문자': 'SMS', '미팅': 'Visit' }
  const m = map[taskType]
  return m && methods.includes(m) ? m : (methods[0] || 'Email')
}

/** 오늘로부터 n일 뒤 (YYYY-MM-DD) */
export function daysFromToday(n: number): string {
  return localDateStr(new Date(Date.now() + n * 864e5))
}

export interface NewTaskInput { title: string; type: string; due: string; note?: string }

/** 리드에 할 일 추가 (담당자는 DB 트리거가 리드 담당자로 채움, 메모는 암호화) */
export async function addLeadTask(leadId: string, t: NewTaskInput): Promise<void> {
  const [row] = await encryptRows('sales_tasks', [{
    lead_id: leadId, task_title: t.title.trim(), task_type: t.type, due_date: t.due,
    status: 'Pending', owner: '', note: t.note?.trim() || null,
  }])
  const { error } = await supabase.from('sales_tasks').insert(row)
  if (error) throw error
}

export interface CompleteTaskInput {
  taskId: string
  leadId: string
  /** 완료 결과를 Activity로 남길 때 */
  activity?: { type: string; result: string; note: string }
  /** 단계를 바꿀 때 (현재 단계와 다를 때만) */
  stage?: { from: string; to: string; lost?: LostReasonInput }
  /** 이어서 할 일 */
  next?: NewTaskInput
}

/** 할 일 완료 → 결과 기록 → 단계 변경 → 다음 할 일 등록을 한 번에 */
export async function completeTask(input: CompleteTaskInput): Promise<void> {
  const today = localDateStr()
  const { error } = await supabase.from('sales_tasks').update({ status: 'Done', completed_at: today }).eq('id', input.taskId)
  if (error) throw error

  if (input.activity) {
    const [act] = await encryptRows('sales_activities', [{
      lead_id: input.leadId, activity_type: input.activity.type, activity_result: input.activity.result,
      activity_date: today, note: input.activity.note.trim() || null,
      created_by: '', // DB 트리거(set_actor)가 실제 작업자로 채움
    }])
    const { error: aErr } = await supabase.from('sales_activities').insert(act)
    if (aErr) throw aErr
  }

  if (input.stage && input.stage.to !== input.stage.from) {
    const { error: sErr } = await supabase.from('sales_leads')
      .update({ current_stage: input.stage.to, ...(input.stage.lost || {}) }).eq('id', input.leadId)
    if (sErr) throw sErr
    await logStageChange(input.leadId, input.stage.from, input.stage.to)
  }

  if (input.next && input.next.title.trim()) await addLeadTask(input.leadId, input.next)
}
