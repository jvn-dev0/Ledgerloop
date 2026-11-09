export function formatDate(value: string, style: "medium" | "long" = "medium") {
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  return new Intl.DateTimeFormat("en", { dateStyle: style, timeZone: "UTC" }).format(new Date(dateValue));
}
