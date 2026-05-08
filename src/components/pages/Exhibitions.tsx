import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exhColor, costColor, formatEventDate, isPastEvent } from '../../lib/utils'
import type { Exhibition, Proposal, BudgetItem } from '../../types/database'

const CUR_SYM: Record<string, string> = { KRW: '₩', JPY: '¥', USD: '$', EUR: '€', SGD: 'S$' }

function fmtCur(amt: number, cur: string) {
  return (CUR_SYM[cur] || cur) + Math.round(amt).toLocaleString()
}

function budgetStr(budget: BudgetItem[]): string {
  const bc: Record<string, number> = {}
  for (const b of budget) { const c = (b as any).currency || 'KRW'; bc[c] = (bc[c] || 0) + b.curr }
  return Object.entries(bc).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtCur(v, c)).join(' + ') || '-'
}

interface ExhEntry {
  exh: Exhibition
  proposals: (Proposal & { budget: BudgetItem[] })[]
}

export default function Exhibitions() {
  const navigate = useNavigate()
  const [data, setData] = useState<ExhEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  async function load() {
    const [{ data: exhData }, { data: propData }] = await Promise.all([
      supabase.from('exhibitions').select('*').order('name'),
      supabase.from('proposals').select('*').order('year', { ascending: true }),
    ])
    const entries: ExhEntry[] = (exhData || []).map(exh => ({
      exh,
      proposals: ((propData || []) as unknown as Proposal[])
        .filter(p => p.exhibition_id === exh.id)
        .map(p => ({ ...p, budget: (p.budget as unknown as BudgetItem[]) || [] }))
    }))
    setData(entries)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteExhibition(exhId: string) {
    await supabase.from('proposals').delete().eq('exhibition_id', exhId)
    await supabase.from('exhibitions').delete().eq('id', exhId)
    setDeleteConfirm(null)
    load()
  }

  if (loading) return <div className="view"><div style={{ color: 'var(--muted)', padding: 40 }}>로딩 중...</div></div>

  return (
    <div className="view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sec-hdr" style={{ margin: 0 }}>
          <div className="bar" />
          <div className="txt">기존 박람회</div>
          <div className="sub">{data.length}개 등록됨</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/expo/create')}>+ 새 Proposal 작성</button>
      </div>

      <div className="exh-grid" style={{ marginTop: 20 }}>
        {data.map(({ exh, proposals }) => {
          const latest = proposals[proposals.length - 1]
          const color = exhColor(exh.name)
          const isPast = latest ? isPastEvent(latest.date_of_event, latest.year) : false

          // 누적 예산 (다중 통화)
          const cumByCur: Record<string, number> = {}
          for (const p of proposals) for (const b of p.budget) {
            const c = (b as any).currency || 'KRW'
            cumByCur[c] = (cumByCur[c] || 0) + b.curr
          }
          const cumBudgetStr = Object.entries(cumByCur).sort(([a], [b]) => a === 'KRW' ? -1 : 1).map(([c, v]) => fmtCur(v, c)).join(' + ') || '-'

          return (
            <div key={exh.id} className="exh-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="top-bar" style={{ background: color }} />
              <div className="ec-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* 헤더 */}
                <div className="ec-hdr">
                  <div className="ec-name" style={{ color }}>{exh.name}</div>
                  <div className="ec-badges" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <span className="badge" style={{ background: exh.recurring ? '#2E7D51' : 'var(--amber)' }}>
                      {exh.recurring ? '기존' : '신규'}
                    </span>
                    {latest && (
                      <span className="badge" style={{ background: isPast ? '#7B8AA0' : 'var(--green)' }}>
                        {isPast ? '완료' : '예정'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ec-meta">
                  {latest ? `${formatEventDate(latest.date_of_event, latest.year)} · ${latest.venue}` : '등록된 Proposal 없음'}
                </div>

                {/* 참가 이력 스크롤 */}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
                  참가 이력 {proposals.length}회
                </div>
                <div style={{ height: 100, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8, padding: '4px 10px', background: '#FDFBFB', marginBottom: 12 }}>
                  {[...proposals].reverse().map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', marginRight: 8 }}>
                        {p.year} · {formatEventDate(p.date_of_event, p.year)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{budgetStr(p.budget)}</span>
                        <button className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: 10 }}
                          onClick={() => navigate('/expo/create', { state: { exhId: exh.id } })}>편집</button>
                      </div>
                    </div>
                  ))}
                  {proposals.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>이력 없음</div>}
                </div>

                {/* 누적 예산 */}
                <div style={{ fontSize: 16, fontWeight: 800, color, marginBottom: 12 }}>
                  누적 예산: {cumBudgetStr}
                </div>

                {/* 최신 예산 항목 */}
                {latest && latest.budget.slice(0, 3).map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: costColor(b.item), display: 'inline-block' }} />
                      {b.item}
                    </span>
                    <span>{fmtCur(b.curr, (b as any).currency || 'KRW')}</span>
                  </div>
                ))}
                {latest && latest.budget.length > 3 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>외 {latest.budget.length - 3}개...</div>
                )}

                {/* 버튼 */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    onClick={() => navigate('/expo/create', { state: { exhId: exh.id } })}>✏️ Proposal 작성</button>
                  <button className="btn btn-muted btn-sm" style={{ flex: 1 }}
                    onClick={() => navigate('/expo/payments', { state: { key: `${exh.key}_${latest?.year}` } })}>💰 결제</button>
                  <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => setDeleteConfirm(exh.id)}>삭제</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {deleteConfirm && (
        <div className="modal-bg open">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-hdr">
              <h3>박람회 삭제</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              이 박람회와 모든 관련 Proposal을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="modal-footer">
              <button className="btn btn-muted" onClick={() => setDeleteConfirm(null)}>취소</button>
              <button className="btn btn-red" onClick={() => deleteExhibition(deleteConfirm)}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
