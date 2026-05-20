import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { krw, exhColor } from '../../lib/utils'
import type { Exhibition, Proposal, Result, ActualCost, MarketingActivity } from '../../types/database'
import { useToast } from '../../contexts/ToastContext'
import pptxgen from 'pptxgenjs'
import { useLang } from '../../contexts/LangContext'

interface ReportKey { label: string; exhibition_key: string }

export default function Report() {
  const { showToast } = useToast()
  const { t } = useLang()
  const location = useLocation()
  const initKey = (location.state as any)?.key || null
  const [reportKeys, setReportKeys] = useState<ReportKey[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [report, setReport] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: exhData }, { data: propData }, { data: resultData }] = await Promise.all([
      supabase.from('exhibitions').select('*'),
      supabase.from('proposals').select('*').order('year'),
      supabase.from('results').select('*'),
    ])
    const exhMap: Record<string, Exhibition> = {}
    for (const e of (exhData || [])) exhMap[e.id] = e

    const keys: ReportKey[] = ((propData || []) as unknown as Proposal[]).map(p => {
      const exh = exhMap[p.exhibition_id]
      return { label: (exh?.name || '') + ' ' + p.year, exhibition_key: (exh?.key || '') + '_' + p.year }
    })
    setReportKeys(keys)

    const resultMap: Record<string, Result> = {}
    for (const r of (resultData || []) as unknown as Result[]) resultMap[r.exhibition_key] = r

    const sel = initKey || keys[0]?.exhibition_key
    if (sel) {
      setSelected(sel)
      setReport(resultMap[sel] || null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function selectKey(k: string) {
    setSelected(k)
    const { data } = await supabase.from('results').select('*').eq('exhibition_key', k).single()
    setReport(data as Result | null)
  }

  async function saveReport() {
    if (!report || !selected) return
    setSaving(true)
    const { data: existing } = await supabase.from('results').select('id').eq('exhibition_key', selected).single()
    if (existing) {
      await supabase.from('results').update(report as unknown as never).eq('id', existing.id)
    } else {
      await supabase.from('results').insert({ ...report, exhibition_key: selected } as unknown as never)
    }
    setSaving(false)
    showToast('보고서가 저장되었습니다.')
  }

  async function exportPPT() {
    if (!r || !selected) return
    const costs = r.actual_costs || []
    const totalB = costs.reduce((s, a) => s + (a.budgeted || 0), 0)
    const totalA = costs.reduce((s, a) => s + (a.actual || 0), 0)
    const pptx = new pptxgen()
    pptx.layout = 'LAYOUT_WIDE'

    const RED = 'DD2430', WHITE = 'FFFFFF', LG = 'F4F5F9'

    const newSlide = (num: number, title: string) => {
      const sl = pptx.addSlide()
      sl.addShape('rect' as any, { x: 0, y: 0, w: 13.33, h: 0.75, fill: { color: RED }, line: { color: RED, width: 0 } })
      sl.addText(`${num}.  ${title}`, { x: 0.25, y: 0, w: 13, h: 0.75, fontSize: 24, color: WHITE, fontFace: 'Calibri', valign: 'middle' })
      return sl
    }

    // Cover
    const cv = pptx.addSlide()
    cv.addShape('rect' as any, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: 'F6F4F4' }, line: { color: 'F6F4F4', width: 0 } })
    cv.addShape('rect' as any, { x: 0, y: 0, w: 13.33, h: 1.2, fill: { color: RED }, line: { color: RED, width: 0 } })
    cv.addText(r.cover_title || selected, { x: 1, y: 2, w: 11, h: 2, fontSize: 36, bold: false, color: '000000', fontFace: 'Calibri', valign: 'middle' })
    cv.addText(`${r.cover_date || ''}   By ${r.cover_author || 'Andrew'}`, { x: 1, y: 4.2, w: 11, h: 0.5, fontSize: 18, color: '555555', fontFace: 'Calibri' })

    // Section helper
    const addBullets = (sl: ReturnType<typeof pptx.addSlide>, items: string[], x = 1, y = 0.9, w = 11.5, h = 5.6) => {
      const valid = items.filter(s => s && s.trim())
      if (!valid.length) return
      const runs: any[] = []
      valid.forEach((s, i) => {
        runs.push({ text: '• ', options: { bold: true, color: '000000', fontSize: 20 } })
        runs.push({ text: s, options: { bold: false, color: '000000', fontSize: 20, breakLine: i < valid.length - 1 } })
      })
      sl.addText(runs, { x, y, w, h, fontFace: 'Calibri', valign: 'top', paraSpaceAfter: 12, lineSpacingMultiple: 1.3 })
    }

    // 1. Objective
    if (r.objective) {
      const sl = newSlide(1, 'Objective')
      sl.addText(r.objective, { x: 0.84, y: 0.9, w: 11.66, h: 6, fontSize: 24, bold: true, color: '000000', fontFace: 'Calibri', valign: 'middle' })
    }

    // 2. Event Overview
    if (r.event_date || r.event_venue) {
      const sl = newSlide(2, 'Event Overview')
      const lines: any[] = [
        { text: 'Date', options: { bold: true, color: '000000', fontSize: 28 } },
        { text: ` : ${r.event_date || ''}`, options: { bold: false, color: '000000', fontSize: 28, breakLine: true } },
        { text: 'Location', options: { bold: true, color: '000000', fontSize: 28 } },
        { text: ` : ${r.event_venue || ''}`, options: { bold: false, color: '000000', fontSize: 28, breakLine: true } },
      ]
      if (r.event_target) {
        lines.push({ text: 'Target', options: { bold: true, color: '000000', fontSize: 28 } })
        lines.push({ text: ` : ${r.event_target}`, options: { bold: false, color: '000000', fontSize: 28 } })
      }
      sl.addText(lines, { x: 1, y: 0.9, w: 11, h: 5.5, fontFace: 'Calibri', valign: 'middle', paraSpaceAfter: 18, lineSpacingMultiple: 1.5 })
    }

    // 3. Cost
    if (costs.length) {
      const sl = newSlide(3, 'Cost')
      const hdr = [
        { text: '항목', options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 13 } },
        { text: '승인 예산', options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 13, align: 'right' as any } },
        { text: '실제 지출', options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 13, align: 'right' as any } },
        { text: '차이', options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 13, align: 'right' as any } },
      ]
      const rows = costs.map((a, ri) => {
        const d = (a.actual || 0) - (a.budgeted || 0)
        const bg = ri % 2 === 0 ? LG : WHITE
        return [
          { text: a.item || '', options: { color: '000000', fill: { color: bg }, fontSize: 12 } },
          { text: a.budgeted ? '₩' + a.budgeted.toLocaleString() : '-', options: { color: '595959', align: 'right' as any, fill: { color: bg }, fontSize: 12 } },
          { text: a.actual ? '₩' + a.actual.toLocaleString() : '-', options: { color: '000000', align: 'right' as any, fill: { color: bg }, fontSize: 12 } },
          { text: a.actual ? (d > 0 ? `▲ ₩${d.toLocaleString()}` : d < 0 ? `▼ ₩${Math.abs(d).toLocaleString()}` : '-') : '-', options: { color: d > 0 ? 'C00000' : d < 0 ? '375623' : '595959', align: 'right' as any, bold: !!a.actual, fill: { color: bg }, fontSize: 12 } },
        ]
      })
      const tD = totalA - totalB
      const totalRow = [
        { text: '합계', options: { bold: true, color: '000000', fill: { color: 'E0E0E0' }, fontSize: 13 } },
        { text: '₩' + totalB.toLocaleString(), options: { bold: true, align: 'right' as any, fill: { color: 'E0E0E0' }, fontSize: 13, color: '000000' } },
        { text: totalA ? '₩' + totalA.toLocaleString() : '-', options: { bold: true, align: 'right' as any, fill: { color: 'E0E0E0' }, fontSize: 13, color: '000000' } },
        { text: totalA ? (tD > 0 ? `▲ ₩${tD.toLocaleString()} 초과` : tD < 0 ? `▼ ₩${Math.abs(tD).toLocaleString()} 절감` : '동일') : '-', options: { bold: true, color: tD > 0 ? 'C00000' : tD < 0 ? '375623' : '000000', align: 'right' as any, fill: { color: 'E0E0E0' }, fontSize: 13 } },
      ]
      sl.addTable([hdr, ...rows, totalRow], { x: 0.5, y: 0.9, w: 12.3, rowH: 0.50, colW: [3.5, 2.5, 2.5, 2.5], border: { pt: 0.5, color: 'CCCCCC' }, autoPage: false })
    }

    // 4. Marketing Activities
    if ((r.marketing_activities || []).length) {
      const sl = newSlide(4, 'Marketing Activities')
      addBullets(sl, (r.marketing_activities as any[]).map(a => `[${(a as any).type || ''}] ${(a as any).description || ''} → ${(a as any).result || ''}`))
    }

    // 5. Registration Results
    const regR = r.reg_remittance || 0, regC = r.reg_card || 0, regB = r.reg_biz || 0, regO = r.reg_onboard || 0
    if (regR || regC || regB) {
      const sl = newSlide(5, 'Registration Results')
      const lines: string[] = []
      if (regR) lines.push(`${regR} Registration on Remittance`)
      if (regC) lines.push(`${regC} Premium Card Issues`)
      if (regB) lines.push(`${regB} Registered + ${regO} Onboarded on GME BIZ`)
      addBullets(sl, lines, 1, 0.9, 11.5, 5)
    }

    // 6-9. Bullet sections
    const sections: [number, string, string[]][] = [
      [6, 'Shortcomings', r.shortcomings || []],
      [7, 'Improvements', r.improvements || []],
      [8, 'Recommendations & Follow-up', r.recommendations || []],
      [9, 'Request', r.requests || []],
    ]
    for (const [num, title, items] of sections) {
      if (items.length) { const sl = newSlide(num, title); addBullets(sl, items) }
    }

    // 10. Conclusion
    if (r.conclusion) {
      const sl = newSlide(10, 'Conclusion')
      sl.addText(r.conclusion, { x: 0.84, y: 0.9, w: 11.66, h: 6, fontSize: 20, color: '000000', fontFace: 'Calibri', valign: 'top', paraSpaceAfter: 10 })
    }

    const fname = (r.cover_title || selected).replace(/[\s/\\]/g, '_') + '_Result_Report.pptx'
    await pptx.writeFile({ fileName: fname })
    showToast('PPT가 다운로드되었습니다.')
  }

  function initReport(): Result {
    return {
      id: '', exhibition_key: selected || '',
      objective: '', event_date: '', event_venue: '', event_target: '',
      actual_costs: [], marketing_activities: [], marketing_photos: [],
      reg_remittance: 0, reg_card: 0, reg_biz: 0, reg_onboard: 0,
      cost_per_person: 0, visitors: 0, new_merchants: 0, new_registrations: 0,
      shortcomings: [], improvements: [], recommendations: [], requests: [],
      conclusion: '', cover_title: selected || '', cover_date: '', cover_author: '',
      sections_enabled: {}
    }
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>{t('loading')}</div></div>

  const r = report || initReport()

  function updateField(field: keyof Result, value: any) {
    setReport(prev => ({ ...(prev || initReport()), [field]: value }))
  }

  function updateCost(i: number, field: keyof ActualCost, value: any) {
    const costs = [...(r.actual_costs || [])]
    costs[i] = { ...costs[i], [field]: value }
    updateField('actual_costs', costs)
  }

  function addCost() {
    updateField('actual_costs', [...(r.actual_costs || []), { item: '', budgeted: 0, actual: 0, currency: 'KRW' }])
  }

  function updateBullet(field: 'shortcomings' | 'improvements' | 'recommendations' | 'requests', i: number, val: string) {
    const arr = [...((r[field] as string[]) || [])]
    arr[i] = val
    updateField(field, arr)
  }

  function addBullet(field: 'shortcomings' | 'improvements' | 'recommendations' | 'requests') {
    updateField(field, [...((r[field] as string[]) || []), ''])
  }

  const totalBudgeted = (r.actual_costs || []).reduce((s, c) => s + (c.budgeted || 0), 0)
  const totalActual = (r.actual_costs || []).reduce((s, c) => s + (c.actual || 0), 0)

  return (
    <div className="view">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">{t('report_title')}</div>
        <div className="sub">{t('report_sub')}</div>
      </div>
      <div className="report-layout">
        {/* Left */}
        <div className="report-list">
          {reportKeys.map(k => (
            <div key={k.exhibition_key} className={`report-list-item${selected === k.exhibition_key ? ' active' : ''}`} onClick={() => selectKey(k.exhibition_key)}>
              {k.label}
            </div>
          ))}
        </div>

        {/* Right */}
        {selected ? (
          <div>
            {/* 커버 슬라이드 */}
            <div style={{ background: 'var(--light)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>{t('cover_slide')}</div>
              <div className="form-row cols3">
                <div><label style={{ marginTop: 0 }}>{t('cover_title_lbl')}</label><input value={r.cover_title || ''} onChange={e => updateField('cover_title', e.target.value)} /></div>
                <div><label style={{ marginTop: 0 }}>{t('cover_date_lbl')}</label><input type="date" value={r.cover_date || ''} onChange={e => updateField('cover_date', e.target.value)} /></div>
                <div><label style={{ marginTop: 0 }}>{t('cover_author_lbl')}</label><input value={r.cover_author || 'Andrew'} onChange={e => updateField('cover_author', e.target.value)} /></div>
              </div>
            </div>

            {/* Section 1: Objective */}
            <SectionHeader num={1} title="Objective" enabled={r.sections_enabled?.['1'] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, '1': v })} />
            <textarea rows={3} style={{ width: '100%', fontSize: 13, border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 13px', resize: 'vertical', fontFamily: 'inherit', marginBottom: 4, boxSizing: 'border-box' }}
              placeholder="박람회 참가 목적을 입력하세요..."
              value={r.objective || ''} onChange={e => updateField('objective', e.target.value)} />

            {/* Section 2: Event Overview */}
            <SectionHeader num={2} title="Event Overview" enabled={r.sections_enabled?.['2'] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, '2': v })} />
            <div className="form-row cols3" style={{ marginBottom: 16 }}>
              <div><label style={{ marginTop: 0 }}>{t('event_period')}</label><input value={r.event_date || ''} onChange={e => updateField('event_date', e.target.value)} /></div>
              <div><label style={{ marginTop: 0 }}>{t('venue')}</label><input value={r.event_venue || ''} onChange={e => updateField('event_venue', e.target.value)} /></div>
              <div><label style={{ marginTop: 0 }}>타겟 고객</label><input value={r.event_target || ''} onChange={e => updateField('event_target', e.target.value)} /></div>
            </div>

            {/* Section 3: Cost */}
            <SectionHeader num={3} title="Cost — 예산 vs 실제 지출" enabled={r.sections_enabled?.['3'] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, '3': v })} />

            {/* Actual costs */}
            <table className="actual-table" style={{ marginBottom: 6 }}>
              <thead><tr><th>{t('item_col')}</th><th style={{ textAlign: 'right' }}>{t('budgeted')}</th><th style={{ textAlign: 'right' }}>{t('actual')}</th><th style={{ textAlign: 'right' }}>{t('diff')}</th><th>{t('note_col')}</th><th></th></tr></thead>
              <tbody>
                {(r.actual_costs || []).map((c, i) => {
                  const diff = (c.actual || 0) - (c.budgeted || 0)
                  return (
                    <tr key={i}>
                      <td><input value={c.item} onChange={e => updateCost(i, 'item', e.target.value)} /></td>
                      <td><input type="number" value={c.budgeted || ''} style={{ textAlign: 'right' }} onChange={e => updateCost(i, 'budgeted', parseInt(e.target.value) || 0)} /></td>
                      <td><input type="number" value={c.actual || ''} style={{ textAlign: 'right' }} onChange={e => updateCost(i, 'actual', parseInt(e.target.value) || 0)} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={diff > 0 ? 'over' : diff < 0 ? 'under' : ''}>
                          {c.actual ? (diff > 0 ? `▲ ${krw(diff)}` : diff < 0 ? `▼ ${krw(Math.abs(diff))}` : '-') : '-'}
                        </span>
                      </td>
                      <td><input value={(c as any).note || ''} placeholder="차이 사유..." onChange={e => updateCost(i, 'note' as any, e.target.value)} /></td>
                      <td><button onClick={() => { const arr = [...(r.actual_costs || [])]; arr.splice(i, 1); updateField('actual_costs', arr) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>{t('budget_total')}</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{krw(totalBudgeted)}</strong></td>
                  <td style={{ textAlign: 'right' }}><strong style={{ color: (totalActual - totalBudgeted) > 0 ? 'var(--danger)' : (totalActual - totalBudgeted) < 0 ? 'var(--green)' : 'inherit' }}>{totalActual ? krw(totalActual) : '-'}</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={totalActual - totalBudgeted > 0 ? 'over' : totalActual - totalBudgeted < 0 ? 'under' : ''}>
                      {totalActual ? (totalActual - totalBudgeted > 0 ? `▲ ${krw(totalActual - totalBudgeted)} 초과` : totalActual - totalBudgeted < 0 ? `▼ ${krw(Math.abs(totalActual - totalBudgeted))} 절감` : '동일') : '-'}
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
            <button className="add-row-btn" onClick={addCost} style={{ marginBottom: 16 }}>{t('add_cost_item')}</button>

            {/* Section 4: Marketing Activities */}
            <SectionHeader num={4} title="Marketing Activities" enabled={r.sections_enabled?.['4'] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, '4': v })} />
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700 }}>{t('marketing_activities')}</h4>
                <button className="btn btn-muted btn-sm" onClick={() => updateField('marketing_activities', [...(r.marketing_activities || []), { type: '', description: '', result: '' }])}>{t('add_marketing')}</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, width: 100 }}>타입</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>내용</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>결과</th>
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(r.marketing_activities || []).map((a, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '4px 8px' }}>
                        <select value={(a as MarketingActivity).type} onChange={e => { const arr = [...(r.marketing_activities || [])]; (arr[i] as MarketingActivity).type = e.target.value; updateField('marketing_activities', arr) }} style={{ padding: '5px 8px', fontSize: 12 }}>
                          {['', 'SNS', 'Email', 'Banner', 'Flyer', 'Event', 'PR', 'Other'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input value={(a as MarketingActivity).description} onChange={e => { const arr = [...(r.marketing_activities || [])]; (arr[i] as MarketingActivity).description = e.target.value; updateField('marketing_activities', arr) }} style={{ fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 8px' }}>
                        <input value={(a as MarketingActivity).result} onChange={e => { const arr = [...(r.marketing_activities || [])]; (arr[i] as MarketingActivity).result = e.target.value; updateField('marketing_activities', arr) }} style={{ fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button onClick={() => { const arr = [...(r.marketing_activities || [])]; arr.splice(i, 1); updateField('marketing_activities', arr) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                  {(r.marketing_activities || []).length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>마케팅 활동 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 5: Registration Results */}
            <SectionHeader num={5} title="Registration Results" enabled={r.sections_enabled?.['5'] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, '5': v })} />
            <div className="perf-grid" style={{ marginBottom: 12 }}>
              {([
                { lbl: 'Remittance 등록', field: 'reg_remittance', color: 'var(--accent)' },
                { lbl: 'Premium Card 발급', field: 'reg_card', color: '#7B2D8B' },
                { lbl: 'BIZ Merchant 등록', field: 'reg_biz', color: 'var(--green)' },
                { lbl: 'Onboard 완료', field: 'reg_onboard', color: 'var(--amber)' },
                { lbl: '방문객 수', field: 'visitors', color: '#3A5FA0' },
                { lbl: '신규 머천트', field: 'new_merchants', color: '#C47D1A' },
              ] as { lbl: string; field: keyof Result; color: string }[]).map(m => (
                <div key={m.field} className="perf-card">
                  <div className="pl">{m.lbl}</div>
                  <input
                    type="number"
                    style={{ fontSize: 26, fontWeight: 800, color: m.color, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                    value={(r[m.field] as number) || 0}
                    onChange={e => updateField(m.field, parseInt(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div className="card-sm" style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{t('per_person_cost')}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>
                  {(() => {
                    const totalReg = (r.reg_remittance || 0) + (r.reg_card || 0) + (r.reg_biz || 0)
                    return totalReg > 0 ? '₩' + Math.round(totalActual / totalReg).toLocaleString() : '-'
                  })()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>총 실지출 ÷ 총 등록 수</div>
              </div>
              <div className="card-sm" style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>신규 등록</div>
                <input
                  type="number"
                  style={{ fontSize: 22, fontWeight: 800, color: '#3A5FA0', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                  value={r.new_registrations || 0}
                  onChange={e => updateField('new_registrations', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Photo gallery */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                {t('photos_title')}
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>{t('photos_sub')}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {(r.marketing_photos || []).map((photo, i) => (
                  <div key={i} style={{ position: 'relative', width: 160, height: 120, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border2)' }}>
                    <img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    <button onClick={() => { const arr = [...(r.marketing_photos || [])]; arr.splice(i, 1); updateField('marketing_photos', arr) }}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.6)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
                  </div>
                ))}
                <label style={{ width: 160, height: 120, border: '2px dashed var(--border2)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--light)', margin: 0 }}>
                  <span style={{ fontSize: 24, marginBottom: 6 }}>📷</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('add_photo')}</span>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                    const files = Array.from(e.target.files || [])
                    files.forEach(file => {
                      const reader = new FileReader()
                      reader.onload = ev => {
                        updateField('marketing_photos', [...(r.marketing_photos || []), ev.target?.result as string])
                      }
                      reader.readAsDataURL(file)
                    })
                    e.target.value = ''
                  }} />
                </label>
              </div>
            </div>

            {/* Bullet sections */}
            {([
              [6, 'Shortcomings', 'shortcomings', '미흡한 점'],
              [7, 'Improvements', 'improvements', '개선 사항'],
              [8, 'Recommendations & Follow-up', 'recommendations', '제언'],
              [9, 'Request', 'requests', '요청 사항'],
            ] as [number, string, 'shortcomings' | 'improvements' | 'recommendations' | 'requests', string][]).map(([num, title, field, label]) => (
              <div key={field}>
                <SectionHeader num={num} title={title} enabled={r.sections_enabled?.[String(num)] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, [String(num)]: v })} />
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700 }}>{label}</h4>
                    <button className="btn btn-muted btn-sm" onClick={() => addBullet(field)}>+ 추가</button>
                  </div>
                  {((r[field] as string[]) || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ minWidth: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 5 }}>{i + 1}</div>
                      <textarea rows={2} value={item} onChange={e => updateBullet(field, i, e.target.value)} style={{ flex: 1, fontSize: 13, border: '1px solid var(--border2)', borderRadius: 7, padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button onClick={() => { const arr = [...((r[field] as string[]) || [])]; arr.splice(i, 1); updateField(field, arr) }} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, marginTop: 4, lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Section 10: Conclusion */}
            <SectionHeader num={10} title="Conclusion" enabled={r.sections_enabled?.['10'] !== false} onToggle={v => updateField('sections_enabled', { ...r.sections_enabled, '10': v })} />
            <div className="card" style={{ marginBottom: 16 }}>
              <label style={{ marginTop: 0, fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{t('conclusion_label')}</label>
              <textarea value={r.conclusion || ''} onChange={e => updateField('conclusion', e.target.value)} rows={4} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-green" onClick={saveReport} disabled={saving} style={{ flex: 1, padding: 14 }}>
                {saving ? t('saving') : t('save_report')}
              </button>
              <button className="btn btn-primary" onClick={exportPPT} style={{ flex: 1, padding: 14 }}>
                {t('export_ppt')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 14, padding: 20 }}>{t('select_report')}</div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ num, title, enabled, onToggle }: { num: number; title: string; enabled: boolean; onToggle: (v: boolean) => void }) {
  const { t } = useLang()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 14px', paddingBottom: 9, borderBottom: '2px solid var(--accent)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 0, margin: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer', margin: 0 }} />
      </label>
      <div style={{ background: enabled ? 'var(--accent)' : 'var(--muted)', color: 'white', fontSize: 13, fontWeight: 700, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', opacity: enabled ? 1 : 0.35 }}>{title}</div>
      <span style={{ fontSize: 11, marginLeft: 4, color: enabled ? 'var(--green)' : 'var(--muted)' }}>{enabled ? t('ppt_include') : t('ppt_exclude')}</span>
    </div>
  )
}
