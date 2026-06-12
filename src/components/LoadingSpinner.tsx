export default function LoadingSpinner({ text = '데이터를 불러오는 중…' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14, gap: 10 }}>
      <div style={{ width: 20, height: 20, border: '2.5px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
      {text}
    </div>
  )
}
