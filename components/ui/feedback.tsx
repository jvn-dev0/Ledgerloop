export function QueryFeedback({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <div className="alert" role="alert">{error}</div>}{notice && <div className="notice" role="status">{notice}</div>}</>;
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="list-empty"><strong>{title}</strong>{children}</div>;
}
