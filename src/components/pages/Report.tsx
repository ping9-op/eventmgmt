import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { krw, exhColor } from '../../lib/utils'
import type { Exhibition, Proposal, Result, ActualCost, MarketingActivity } from '../../types/database'
import { useToast } from '../../contexts/ToastContext'
import pptxgen from 'pptxgenjs'

interface ReportKey { label: string; exhibition_key: string }

export default function Report() {
  const { showToast } = useToast()
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

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

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
        <div className="txt">결과 보고서</div>
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
        {selected && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>기본 정보</h4>
              <div className="form-row cols2">
                <div><label style={{ marginTop: 0 }}>보고서 제목</label><input value={r.cover_title || ''} onChange={e => updateField('cover_title', e.target.value)} /></div>
                <div><label style={{ marginTop: 0 }}>작성자</label><input value={r.cover_author || ''} onChange={e => updateField('cover_author', e.target.value)} /></div>
              </div>
              <div className="form-row cols2">
                <div><label>행사 기간</label><input value={r.event_date || ''} onChange={e => updateField('event_date', e.target.value)} /></div>
                <div><label>장소</label><input value={r.event_venue || ''} onChange={e => updateField('event_venue', e.target.value)} /></div>
              </div>
            </div>

            {/* Performance metrics */}
            <div className="perf-grid">
              {[
                { lbl: '방문객', field: 'visitors' as keyof Result },
                { lbl: '신규 머천트', field: 'new_merchants' as keyof Result },
                { lbl: '신규 등록', field: 'new_registrations' as keyof Result },
                { lbl: 'Remittance', field: 'reg_remittance' as keyof Result },
                { lbl: 'BIZ 등록', field: 'reg_biz' as keyof Result },
                { lbl: '온보딩', field: 'reg_onboard' as keyof Result },
              ].map(m => (
                <div key={m.field} className="perf-card">
                  <div className="pl">{m.lbl}</div>
                  <input
                    type="number"
                    style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', width: '100%' }}
                    value={r[m.field] as number || 0}
                    onChange={e => updateField(m.field, parseInt(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>

            {/* Actual costs */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700 }}>실제 비용</h4>
                <button className="btn btn-muted btn-sm" onClick={addCost}>+ 항목 추가</button>
              </div>
              <table className="actual-table">
                <thead><tr><th>항목</th><th>예산</th><th>실제</th><th>통화</th><th>차이</th></tr></thead>
                <tbody>
                  {(r.actual_costs || []).map((c, i) => {
                    const diff = (c.actual || 0) - (c.budgeted || 0)
                    return (
                      <tr key={i}>
                        <td><input value={c.item} onChange={e => updateCost(i, 'item', e.target.value)} /></td>
                        <td><input type="number" value={c.budgeted || ''} onChange={e => updateCost(i, 'budgeted', parseInt(e.target.value) || 0)} /></td>
                        <td><input type="number" value={c.actual || ''} onChange={e => updateCost(i, 'actual', parseInt(e.target.value) || 0)} /></td>
                        <td>
                          <select value={c.currency} onChange={e => updateCost(i, 'currency', e.target.value)} style={{ width: 70 }}>
                            {['KRW','JPY','USD'].map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td><span className={diff > 0 ? 'over' : diff < 0 ? 'under' : ''}>{diff > 0 ? '+' : ''}{diff.toLocaleString()}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>합계</td>
                    <td>{krw(totalBudgeted)}</td>
                    <td><strong>{krw(totalActual)}</strong></td>
                    <td></td>
                    <td><span className={totalActual - totalBudgeted > 0 ? 'over' : 'under'}>{totalActual - totalBudgeted > 0 ? '+' : ''}{(totalActual - totalBudgeted).toLocaleString()}</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Marketing activities */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700 }}>마케팅 활동</h4>
                <button className="btn btn-muted btn-sm" onClick={() => updateField('marketing_activities', [...(r.marketing_activities || []), { type: '', description: '', result: '' }])}>+ 추가</button>
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

            {/* Photo gallery */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                📸 현장 사진
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>PPT에 자동 배치</span>
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
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>사진 추가</span>
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
            {(['shortcomings', 'improvements', 'recommendations', 'requests'] as const).map(field => {
              const labels: Record<string, string> = { shortcomings: '미흡한 점', improvements: '개선 사항', recommendations: '제언', requests: '요청 사항' }
              return (
                <div key={field} className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700 }}>{labels[field]}</h4>
                    <button className="btn btn-muted btn-sm" onClick={() => addBullet(field)}>+ 추가</button>
                  </div>
                  {((r[field] as string[]) || []).map((item, i) => (
                    <input key={i} value={item} onChange={e => updateBullet(field, i, e.target.value)} style={{ marginBottom: 8 }} />
                  ))}
                </div>
              )
            })}

            <div className="card" style={{ marginBottom: 16 }}>
              <label style={{ marginTop: 0, fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>종합 의견</label>
              <textarea value={r.conclusion || ''} onChange={e => updateField('conclusion', e.target.value)} rows={4} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-green" onClick={saveReport} disabled={saving} style={{ flex: 1, padding: 14 }}>
                {saving ? '저장 중...' : '💾 보고서 저장'}
              </button>
              <button className="btn btn-primary" onClick={exportPPT} style={{ flex: 1, padding: 14 }}>
                📊 PPT 내보내기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
