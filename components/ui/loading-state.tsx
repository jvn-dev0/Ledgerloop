export function PageLoadingState({ label }: { label: string }) {
  return (
    <main className="main-content" aria-busy="true" aria-label={`Loading ${label}`}>
      <div className="loading-heading"><span /><span /></div>
      <section className="card loading-panel"><div className="loading-line" /><div className="loading-line short" /><div className="loading-line" /></section>
      <span className="sr-only">Loading {label}…</span>
    </main>
  );
}
