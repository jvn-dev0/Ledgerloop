import { formatMoney } from "@/lib/finance/money";

type MetricIconName = "document" | "check" | "clock" | "alert";

export function SummaryMetric({ label, value, currency, note, tone, icon: iconName }: {
  label: string;
  value: string;
  currency: string;
  note: string;
  tone?: "success" | "warning" | "danger";
  icon: MetricIconName;
}) {
  const icon = {
    document: <><path d="M7 3.75h7l4.25 4.25v11A1.25 1.25 0 0 1 17 20.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" /><path d="M14 4v4h4M8.5 12h7M8.5 15.5h7" /></>,
    check: <><circle cx="12" cy="12" r="8.25" /><path d="m8.5 12 2.25 2.25 4.75-4.75" /></>,
    clock: <><circle cx="12" cy="12" r="8.25" /><path d="M12 7.25v5l3.25 2" /></>,
    alert: <><path d="M12 3.5 21 19H3L12 3.5Z" /><path d="M12 9v4.5M12 16.5h.01" /></>,
  }[iconName];

  return (
    <article className={`card stat-card${tone ? ` ${tone}` : ""}`}>
      <div className="stat-label">{label}<span className="stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span></div>
      <div className="stat-value">{formatMoney(value, currency)}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}
