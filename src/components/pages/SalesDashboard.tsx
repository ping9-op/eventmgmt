import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STAGE_ORDER, STAGE_COLORS, priorityColor } from '../../lib/utils'
import type { SalesLead, SalesTask } from '../../types/database'

export default function SalesDashboard() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<SalesLead[]>([])
  const [tasks, setTasks] = useState<SalesTask[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [{ data: leadData }, { data: taskData }] = await Promise.all([
        supabase.from('sales_leads').select('*'),
        supabase.from('sales_tasks').select('*').neq('status', 'Done'),
      ])
      setLeads((leadData || []) as SalesLead[])
      setTasks((taskData || []) as SalesTask[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  const totalLeads = leads.length
  const activeLeads = leads.filter(l => l.current_stage !== 'Lost' && l.current_stage !== 'Onboarded / Won').length
  const wonLeads = leads.filter(l => l.current_stage === 'Onboarded / Won').length
  const overdueToday = tasks.filter(t => t.due_date < today).length

  const stageCount: Record<string, number> = {}
  for (const l of leads) stageCount[l.current_stage] = (stageCount[l.current_stage] || 0) + 1

  const bySource: Record<string, number> = {}
  for (const l of leads) bySource[l.lead_source] = (bySource[l.lead_source] || 0) + 1
  const maxSrc = Math.max(...Object.values(bySource), 1)

  const recentLeads = [...leads].sort((a, b) => b.registered_date.localeCompare(a.registered_date)).slice(0, 5)
  const upcomingTasks = [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5)

  return (
    <div className="view wide">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">Sales 대시보드</div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        {[
          { lbl: '전체 Lead', val: totalLeads, sub: '등록 합계', click: '/sales/leads' },
          { lbl: '활성 Lead', val: activeLeads, sub: 'Won/Lost 제외', click: '/sales/funnel' },
          { lbl: 'Onboarded', val: wonLeads, sub: '최종 온보딩 완료', click: '/sales/leads' },
          { lbl: '기한 초과 Task', val: overdueToday, sub: '즉시 처리 필요', click: '/sales/followup', danger: overdueToday > 0 },
        ].map((m, i) => (
          <div key={i} className="metric" onClick={() => navigate(m.click)} style={m.danger ? { borderColor: 'var(--danger)' } : {}}>
            <div className="lbl">{m.lbl}</div>
            <div className="val" style={m.danger ? { color: 'var(--danger)' } : {}}>{m.val}</div>
            <div className="sub">{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Funnel overview */}
        <div className="chart-card">
          <div className="chart-lbl">Stage 현황</div>
          {STAGE_ORDER.map(stage => {
            const cnt = stageCount[stage] || 0
            const col = STAGE_COLORS[stage]
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }} onClick={() => navigate('/sales/funnel')}>
                <span style={{ width: 120, fontSize: 13, color: 'var(--text)' }}>{stage}</span>
                <div style={{ flex: 1, height: 22, background: 'var(--light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${totalLeads ? cnt / totalLeads * 100 : 0}%`, height: '100%', background: col?.bg || '#999', minWidth: cnt > 0 ? 4 : 0 }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 13, fontWeight: 700, color: col?.bg || '#999' }}>{cnt}</span>
              </div>
            )
          })}
        </div>

        {/* Lead source */}
        <div className="chart-card">
          <div className="chart-lbl">Lead 소스</div>
          {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, cnt]) => (
            <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ width: 100, fontSize: 13 }}>{src}</span>
              <div style={{ flex: 1, height: 22, background: 'var(--light)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${cnt / maxSrc * 100}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <span style={{ width: 24, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{cnt}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Recent leads */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>최근 등록 Lead</div>
          {recentLeads.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/sales/leads')}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{l.company_name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.contact_person} · {l.event_name}</div>
              </div>
              <span style={{ background: STAGE_COLORS[l.current_stage]?.bg || '#999', color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                {l.current_stage}
              </span>
            </div>
          ))}
        </div>

        {/* Upcoming tasks */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>다가오는 Task</div>
          {upcomingTasks.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/sales/followup')}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.task_title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.owner} · {t.task_type}</div>
              </div>
              <span style={{ fontSize: 12, color: t.due_date < today ? 'var(--danger)' : 'var(--muted)', fontWeight: t.due_date < today ? 700 : 400 }}>
                {t.due_date}
              </span>
            </div>
          ))}
          {upcomingTasks.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>완료된 Task가 없습니다</div>}
        </div>
      </div>
    </div>
  )
}
