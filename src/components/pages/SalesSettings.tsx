import { useState } from 'react'
import { loadSalesSettings, saveSalesSettings } from '../../lib/settings'
import { STAGE_ORDER } from '../../lib/utils'
import { useToast } from '../../contexts/ToastContext'

const CONTACT_METHODS = ['Email', 'Call', 'SMS', 'Kakao', 'Visit']
const LOST_REASONS = ['No Demand', 'Price Issue', 'Competitor Already Used', 'No Response', 'Compliance Issue', 'Service Not Available', 'Internal Priority Low', 'Other']
const CONTRACT_STATUSES = ['Not Sent', 'Sent', 'Under Review', 'Revision Requested', 'Signed', 'Rejected']
const ONBOARD_STATUSES = ['Not Started', 'Waiting Docs', 'Under Review', 'Approved', 'Rejected', 'Completed']

export default function SalesSettings() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState(loadSalesSettings())
  const [addInputs, setAddInputs] = useState<Record<string, string>>({})

  function addItem(key: keyof typeof settings, val: string) {
    if (!val.trim()) return
    const updated = { ...settings, [key]: [...settings[key], val.trim()] }
    setSettings(updated)
    saveSalesSettings(updated)
    setAddInputs(p => ({ ...p, [key]: '' }))
    showToast('추가되었습니다.')
  }

  function removeItem(key: keyof typeof settings, idx: number) {
    const arr = [...settings[key]]
    arr.splice(idx, 1)
    const updated = { ...settings, [key]: arr }
    setSettings(updated)
    saveSalesSettings(updated)
  }

  const settingsGroups: { name: string; key?: keyof typeof settings; items: string[] }[] = [
    { name: 'Lead Source', key: 'sources', items: settings.sources },
    { name: 'Funnel Stage', items: STAGE_ORDER },
    { name: 'Contact Method', items: CONTACT_METHODS },
    { name: 'Lost Reason', items: LOST_REASONS },
    { name: 'Priority', items: ['High', 'Medium', 'Low'] },
    { name: 'Contract Status', items: CONTRACT_STATUSES },
    { name: 'Onboarding Status', items: ONBOARD_STATUSES },
    { name: 'Owner', key: 'owners', items: settings.owners },
    { name: 'Corridor', key: 'corridors', items: settings.corridors },
    { name: 'Business Type', key: 'businessTypes', items: settings.businessTypes },
  ]

  return (
    <div className="view wide">
      <div className="sec-hdr">
        <div className="bar" />
        <div className="txt">Sales 설정</div>
        <div className="sub">Sales 모듈 마스터 데이터 관리</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {settingsGroups.map(group => (
          <div key={group.name} style={{ background: 'white', border: '0.5px solid var(--border2)', borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{group.name}</div>
              {group.key && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={addInputs[group.key] || ''} placeholder="추가..."
                    onChange={e => setAddInputs(p => ({ ...p, [group.key!]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addItem(group.key!, addInputs[group.key!] || '') }}
                    style={{ padding: '4px 9px', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12, width: 100 }} />
                  <button onClick={() => addItem(group.key!, addInputs[group.key!] || '')}
                    style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    + 추가
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--light)', borderRadius: 7, fontSize: 13 }}>
                  <span>{v}</span>
                  {group.key && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => removeItem(group.key!, i)}
                        style={{ padding: '2px 8px', borderRadius: 4, background: 'white', border: '1px solid #FCA5A5', fontSize: 11, cursor: 'pointer', color: '#DC2626' }}>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
