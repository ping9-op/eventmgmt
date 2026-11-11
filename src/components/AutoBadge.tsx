/** 단계별로 자동 배정된 할 일 표시 (sales_tasks.auto_stage가 있는 할 일) */
export default function AutoBadge() {
  return (
    <span title="리드 등록·단계 변경 시 자동으로 배정된 할 일"
      style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 99, background: '#F3F4F6', color: '#6B7280', fontSize: 10, fontWeight: 700, marginRight: 6, verticalAlign: 'middle' }}>
      🤖 자동
    </span>
  )
}
