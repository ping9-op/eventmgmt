interface EmptyStateProps {
  icon?: string
  title: string
  sub?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon = '📭', title, sub, action }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: 'var(--muted)', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: sub ? 6 : 0 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: action ? 18 : 0 }}>{sub}</div>}
      {action && (
        <button className="btn btn-primary btn-sm" onClick={action.onClick} style={{ marginTop: 4 }}>
          {action.label}
        </button>
      )}
    </div>
  )
}
