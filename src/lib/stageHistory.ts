import { supabase } from './supabase'

export async function logStageChange(
  leadId: string,
  fromStage: string | null,
  toStage: string,
  changedBy?: string,
): Promise<void> {
  if (fromStage === toStage) return
  await supabase.from('sales_stage_history').insert({
    lead_id: leadId,
    from_stage: fromStage || null,
    to_stage: toStage,
    changed_by: changedBy || null,
  })
}

export interface StageHistoryRow {
  id: string
  lead_id: string
  from_stage: string | null
  to_stage: string
  changed_at: string
  changed_by: string | null
}

// 각 스테이지별 평균 체류 기간(일) 계산
// history: 전체 이력 (changed_at 오름차순 정렬 필요)
export function computeAvgDaysPerStage(
  history: StageHistoryRow[],
): Record<string, { avgDays: number; sampleCount: number }> {
  // lead별로 그룹핑
  const byLead: Record<string, StageHistoryRow[]> = {}
  for (const r of history) {
    if (!byLead[r.lead_id]) byLead[r.lead_id] = []
    byLead[r.lead_id].push(r)
  }

  // 스테이지별 체류 기간 누적
  const stageAccum: Record<string, number[]> = {}

  for (const rows of Object.values(byLead)) {
    const sorted = [...rows].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i]
      const next = sorted[i + 1]
      const days = Math.round(
        (new Date(next.changed_at).getTime() - new Date(cur.changed_at).getTime()) / 86400000,
      )
      if (days >= 0) {
        if (!stageAccum[cur.to_stage]) stageAccum[cur.to_stage] = []
        stageAccum[cur.to_stage].push(days)
      }
    }
  }

  const result: Record<string, { avgDays: number; sampleCount: number }> = {}
  for (const [stage, days] of Object.entries(stageAccum)) {
    result[stage] = {
      avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
      sampleCount: days.length,
    }
  }
  return result
}
