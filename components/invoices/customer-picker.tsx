"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type CustomerOption = { id: string; name: string; company_name: string | null; email?: string };

export function CustomerPicker({ initialCustomer }: { initialCustomer?: CustomerOption | null }) {
  const [selected, setSelected] = useState<CustomerOption | null>(initialCustomer ?? null);
  const [query, setQuery] = useState(initialCustomer ? `${initialCustomer.name}${initialCustomer.company_name ? ` · ${initialCustomer.company_name}` : ""}` : "");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (selected && query === `${selected.name}${selected.company_name ? ` · ${selected.company_name}` : ""}`) return;
    if (term.length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setError(null);
      try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const result = (await response.json()) as { customers?: CustomerOption[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Customer search failed.");
        setResults(result.customers ?? []);
        setResultQuery(term);
        setActiveIndex(0);
        setOpen(true);
      } catch (searchError) {
        if (controller.signal.aborted) return;
        setResults([]);
        setResultQuery(term);
        setError(searchError instanceof Error ? searchError.message : "Customer search failed.");
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected]);

  function choose(customer: CustomerOption) {
    setSelected(customer);
    setQuery(`${customer.name}${customer.company_name ? ` · ${customer.company_name}` : ""}`);
    setResults([]);
    setOpen(false);
    setError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const visibleResults = resultQuery === query.trim() ? results : [];
    if (event.key === "ArrowDown" && visibleResults.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp" && visibleResults.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === "Enter" && open && visibleResults[activeIndex]) {
      event.preventDefault();
      choose(visibleResults[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const visibleResults = resultQuery === query.trim() ? results : [];

  return (
    <div className="customer-picker">
      <label htmlFor="customer-search">Customer *</label>
      <input
        ref={inputRef}
        className="input"
        id="customer-search"
        type="text"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="customer-options"
        aria-activedescendant={open && results[activeIndex] ? `customer-option-${results[activeIndex].id}` : undefined}
        aria-describedby={error ? "customer-search-error" : undefined}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setSelected(null); setOpen(true); }}
        onFocus={() => { if (results.length) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder="Search by name, company, or email"
        required
      />
      <input type="hidden" name="customer_id" value={selected?.id ?? ""} />
      {open && query.trim().length >= 2 && <div className="customer-picker-popover"><ul id="customer-options" className="customer-options" role="listbox" aria-label="Matching customers">
        {resultQuery !== query.trim() ? <li className="customer-option-empty" role="status">Searching customers…</li> : visibleResults.length ? visibleResults.map((customer, index) => <li key={customer.id} role="presentation"><button id={`customer-option-${customer.id}`} className={`customer-option${activeIndex === index ? " active" : ""}`} type="button" role="option" aria-selected={activeIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(customer)}><span>{customer.name}{customer.company_name && <small>{customer.company_name}</small>}</span><span className="customer-option-email">{customer.email}</span></button></li>) : <li className="customer-option-empty" role="status">No matching customer. Try another search.</li>}
      </ul></div>}
      {error && <span id="customer-search-error" className="field-error" role="alert">{error}</span>}
      {!selected && <span className="field-help">Choose a customer from the search results before saving.</span>}
    </div>
  );
}
