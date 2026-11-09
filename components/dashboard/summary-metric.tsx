import { formatMoney } from "@/lib/finance/money";

export function SummaryMetric({ label, value, currency, note, tone, marker }: {
  label: string;
  value: string;
  currency: string;
  note: string;
  tone?: "success" | "warning" | "danger";
  marker: string;
}) {
  return (
    <article className={`card stat-card${tone ? ` ${tone}` : ""}`}>
      <div className="stat-label">{label}<span className="stat-icon" aria-hidden="true">{marker}</span></div>
      <div className="stat-value">{formatMoney(value, currency)}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}
