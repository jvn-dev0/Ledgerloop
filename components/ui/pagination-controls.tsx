import Link from "next/link";

export function PaginationControls({
  basePath,
  currentPage,
  pageSize,
  totalItems,
  query,
  filters,
}: {
  basePath: string;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  query?: string;
  filters?: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  function href(page: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      {currentPage > 1 ? <Link className="button secondary small" href={href(currentPage - 1)} rel="prev">Previous</Link> : <span className="button secondary small is-disabled" aria-disabled="true">Previous</span>}
      <span className="pagination-count">Page {currentPage} of {totalPages}<span> · {totalItems} total</span></span>
      {currentPage < totalPages ? <Link className="button secondary small" href={href(currentPage + 1)} rel="next">Next</Link> : <span className="button secondary small is-disabled" aria-disabled="true">Next</span>}
    </nav>
  );
}
