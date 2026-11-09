export function StatusBadge({ status, overdue = false }: { status: string; overdue?: boolean }) {
  const label = overdue ? "Overdue" : status;
  const className = overdue ? "overdue" : status.toLowerCase().replace(/[^a-z]/g, "-");
  return <span className={`badge ${className}`}>{label}</span>;
}
