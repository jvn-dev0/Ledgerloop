"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { formatDateTime } from "@/lib/finance/date";

type Message = { id: string; role: "user" | "assistant"; content: string };
type DocumentRecord = { id: string; name: string; mime_type: string; chunk_count: number; updated_at: string };
type ApprovalRecord = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  action_type: string;
  status: string;
  reason: string;
  result: unknown;
  created_at: string;
  expires_at: string;
};
type ActivityRecord = { id: string; tool_name: string; status: string; duration_ms: number | null; created_at: string };
type DraftEvidence = { invoiceNumber?: string; customerName?: string; currency?: string; amount?: string; draft?: string; policyNote?: string; deliveryChannel?: string; destinationAvailable?: boolean; preferenceSaved?: boolean; channelLabel?: string; channelNote?: string; policyReferences?: Array<{ documentName: string; chunkIndex: number; content: string }> };
type PriorityItem = { invoiceNumber: string; customerName: string; amount: string; currency: string; dueDate: string; daysOverdue: number; priorityScore: number; reasons: string[] };
type SummaryEvidence = { currencies?: Array<{ currency: string; outstanding: string; overdue: string; pendingCount: number; paidCount: number }> };
type AgentEvidence = { drafts?: DraftEvidence[]; prioritized?: Array<{ asOf?: string; limitedToOldest100?: boolean; prioritized?: PriorityItem[] }>; summaries?: SummaryEvidence[] };

const toolLabels: Record<string, string> = {
  get_business_summary: "Reading receivables totals",
  list_invoices: "Reviewing invoices",
  get_overdue_invoices: "Finding overdue invoices",
  get_customer_history: "Reviewing customer payment history",
  calculate_receivables: "Calculating outstanding balances",
  retrieve_business_policy: "Searching business policy documents",
  prioritize_collections: "Ranking collection priorities",
  draft_payment_reminder: "Preparing a reminder draft",
  create_approval_request: "Requesting owner approval",
  get_paypal_payment_status: "Checking LedgerLoop payment records",
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function paymentLinkFromResult(value: unknown) {
  if (!value || typeof value !== "object" || !("paymentLink" in value) || typeof value.paymentLink !== "string") return null;
  try {
    const url = new URL(value.paymentLink);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function AgentWorkspace(props: {
  businessName: string;
  databaseReady: boolean;
  initialConversationId: string | null;
  initialMessages: Message[];
  initialDocuments: DocumentRecord[];
  initialApprovals: ApprovalRecord[];
  initialActivity: ActivityRecord[];
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [conversationId, setConversationId] = useState(props.initialConversationId);
  const [messages, setMessages] = useState(props.initialMessages);
  const [documents, setDocuments] = useState(props.initialDocuments);
  const [approvals, setApprovals] = useState(props.initialApprovals);
  const [activity, setActivity] = useState(props.initialActivity);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [activeTools, setActiveTools] = useState<Array<{ id: string; name: string; status: string; elapsedMs?: number }>>([]);
  const [evidence, setEvidence] = useState<AgentEvidence | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedDraft, setCopiedDraft] = useState("");

  const canChat = props.databaseReady && !busy;
  const latestMessageId = useMemo(() => messages[messages.length - 1]?.id, [messages]);

  async function refreshWorkspaceState() {
    const response = await fetch("/api/agent/state", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { documents?: DocumentRecord[]; approvals?: ApprovalRecord[]; activity?: ActivityRecord[] };
    if (payload.documents) setDocuments(payload.documents);
    if (payload.approvals) setApprovals(payload.approvals);
    if (payload.activity) setActivity(payload.activity);
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || !canChat) return;
    setText("");
    setBusy(true);
    setError("");
    setNotice("");
    setEvidence(null);
    setActiveTools([]);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message }]);
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, ...(conversationId ? { conversationId } : {}) }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "The collections assistant is unavailable.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((part) => part.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
          if (payload.type === "conversation" && typeof payload.conversationId === "string") setConversationId(payload.conversationId);
          if (payload.type === "tool" && payload.event && typeof payload.event === "object") {
            const eventData = payload.event as { type?: string; name?: string; callId?: string; elapsedMs?: number };
            if (eventData.name && eventData.callId && eventData.type) {
              setActiveTools((current) => {
                const next = current.filter((tool) => tool.id !== eventData.callId);
                return [...next, {
                  id: eventData.callId as string,
                  name: toolLabels[eventData.name as string] ?? "Running an authorised tool",
                  status: eventData.type === "tool_started" ? "Running" : eventData.type === "tool_completed" ? "Complete" : "Could not complete",
                  elapsedMs: eventData.elapsedMs,
                }];
              });
            }
          }
          if (payload.type === "result" && typeof payload.answer === "string") {
            setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: payload.answer as string }]);
            setEvidence((payload.evidence ?? null) as AgentEvidence | null);
            setNotice("Analysis saved to this business conversation.");
          }
          if (payload.type === "error" && typeof payload.error === "string") streamError = payload.error;
        }
      }
      if (streamError) setError(streamError);
      await refreshWorkspaceState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The collections assistant is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setError("Choose a text, Markdown, or PDF file first.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (selectedDocumentId) form.set("documentId", selectedDocumentId);
      const response = await fetch("/api/knowledge", { method: "POST", body: form });
      const payload = await response.json() as { error?: string; document?: DocumentRecord };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "The policy document could not be indexed.");
      setNotice(`${payload.document.name} is indexed in this business workspace.`);
      if (fileInput.current) fileInput.current.value = "";
      setSelectedDocumentId("");
      await refreshWorkspaceState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The policy document could not be indexed.");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(documentId: string) {
    setError("");
    setNotice("");
    const response = await fetch(`/api/knowledge/${documentId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "The policy document could not be deleted.");
      return;
    }
    setDocuments((current) => current.filter((document) => document.id !== documentId));
    setNotice("Policy document removed from this business workspace.");
    if (selectedDocumentId === documentId) setSelectedDocumentId("");
  }

  async function decideApproval(approvalId: string, decision: "approve" | "reject") {
    setError("");
    setNotice("");
    const response = await fetch(`/api/agent/approvals/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; status?: string; paymentLink?: string };
    if (!response.ok) {
      setError(payload.error ?? "The approval decision could not be saved.");
      return;
    }
    setApprovals((current) => current.map((approval) => approval.id === approvalId
      ? { ...approval, status: payload.status ?? (decision === "approve" ? "executed" : "rejected"), result: payload.paymentLink ? { paymentLink: payload.paymentLink } : approval.result }
      : approval));
    setNotice(decision === "approve" ? "The payment link is ready for owner review." : "Approval request rejected.");
    await refreshWorkspaceState();
  }

  async function copyDraft(draft: DraftEvidence) {
    if (!draft.draft) return;
    try {
      await navigator.clipboard.writeText(draft.draft);
      setCopiedDraft(draft.invoiceNumber ?? "draft");
      window.setTimeout(() => setCopiedDraft(""), 1800);
    } catch {
      setError("Clipboard access is unavailable in this browser.");
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="main-content agent-main">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCIAL OPERATIONS / COLLECTIONS</p>
          <h1 className="page-title">Collections assistant</h1>
          <p className="page-subtitle">A business-scoped workspace for overdue analysis, policy lookup, and owner-reviewed next steps.</p>
        </div>
        <div className="agent-status-pill"><span aria-hidden="true" /> Connected to {props.businessName}</div>
      </div>

      {!props.databaseReady && <div className="agent-migration-notice" role="status"><strong>Day 3 storage is not ready.</strong><span>Apply the checked-in Day 1 and Day 2 migrations, then the Day 3 collections migration in order. The assistant will not use sample financial data.</span></div>}

      {notice && <p className="feedback success" role="status">{notice}</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}

      <div className="agent-layout">
        <section className="agent-panel agent-chat-panel" aria-label="Collections conversation">
          <header className="agent-panel-head">
            <div><span className="agent-kicker">LIVE WORKSPACE</span><h2>Receivables review</h2></div>
            <span className="agent-live-indicator">{busy ? "Working" : "Ready"}</span>
          </header>
          <div className="agent-conversation" aria-live="polite">
            {messages.length === 0 ? (
              <div className="agent-empty-state">
                <div className="agent-empty-mark" aria-hidden="true">L</div>
                <h3>What needs attention?</h3>
                <p>Ask about overdue invoices, outstanding balances, customer payment history, or prepare a reminder draft.</p>
                <div className="agent-suggestions">
                  <button type="button" onClick={() => setText("Which invoices are overdue, and how many days past due is each one?")} disabled={!props.databaseReady}>Show overdue invoices</button>
                  <button type="button" onClick={() => setText("Prioritize my overdue collections and explain the scoring factors.")} disabled={!props.databaseReady}>Prioritize collections</button>
                  <button type="button" onClick={() => setText("Summarize outstanding receivables by currency.")} disabled={!props.databaseReady}>Summarize receivables</button>
                </div>
              </div>
            ) : messages.map((message) => (
              <article className={`agent-message ${message.role}`} key={message.id}>
                <span className="agent-message-label">{message.role === "user" ? "YOU" : "LEDGERLOOP"}</span>
                <p>{message.content}</p>
                {message.id === latestMessageId && message.role === "assistant" && evidence?.summaries?.[0]?.currencies && (
                  <div className="agent-summary-evidence">
                    {evidence.summaries[0].currencies.map((item) => <div key={item.currency}><span>{item.currency} outstanding</span><strong>{item.outstanding} {item.currency}</strong><small>{item.overdue} overdue · {item.pendingCount} pending invoices</small></div>)}
                  </div>
                )}
                {message.id === latestMessageId && message.role === "assistant" && evidence?.prioritized?.[0]?.prioritized?.length ? (
                  <div className="agent-priority-list">
                    <div className="agent-evidence-heading"><strong>Priority queue</strong><span>Ranked from invoice and payment records</span></div>
                    {evidence.prioritized[0].prioritized.map((item) => <div className="agent-priority-row" key={item.invoiceNumber}>
                      <div><strong>{item.invoiceNumber}</strong><span>{item.customerName} · {item.daysOverdue} days overdue · due {formatDate(item.dueDate)}</span><small>{item.reasons.join(" · ")}</small></div>
                      <b>{item.amount} {item.currency}</b>
                    </div>)}
                    {evidence.prioritized[0].limitedToOldest100 && <p className="agent-evidence-footnote">Priority scoring covers the 100 oldest overdue invoices; refine the date or customer to inspect another group.</p>}
                  </div>
                ) : null}
                {message.id === latestMessageId && message.role === "assistant" && evidence?.drafts?.map((draft, index) => (
                  <section className="agent-draft-card" key={`${draft.invoiceNumber}-${index}`}>
                    <div className="agent-draft-head"><div><span className="agent-kicker">{draft.channelLabel ?? "REVIEWABLE DRAFT"}</span><h3>{draft.invoiceNumber} · {draft.customerName}</h3></div><button type="button" className="button secondary small" onClick={() => void copyDraft(draft)}>{copiedDraft === draft.invoiceNumber ? "Copied" : "Copy draft"}</button></div>
                    <pre>{draft.draft}</pre>
                    <p>{draft.channelNote}{draft.destinationAvailable === false ? " The customer record is missing a destination for this channel." : ""}</p>
                    <p>{draft.policyNote}</p>
                    {draft.policyReferences?.length ? <details><summary>{draft.policyReferences.length} relevant policy passage{draft.policyReferences.length === 1 ? "" : "s"}</summary>{draft.policyReferences.map((reference, referenceIndex) => <blockquote key={`${reference.documentName}-${referenceIndex}`}><strong>{reference.documentName}</strong><span>{reference.content}</span></blockquote>)}</details> : null}
                    <div className="agent-draft-warning">Draft only. LedgerLoop has not sent this message.</div>
                  </section>
                ))}
              </article>
            ))}
            {busy && <div className="agent-typing" role="status"><span className="agent-spinner" /> Checking business records…</div>}
          </div>

          {activeTools.length > 0 && <div className="agent-tool-trace" aria-label="Tool execution progress">{activeTools.slice(-5).map((tool) => <div className={`agent-tool-step ${tool.status === "Could not complete" ? "failed" : tool.status === "Complete" ? "complete" : ""}`} key={tool.id}><span aria-hidden="true">{tool.status === "Complete" ? "✓" : tool.status === "Could not complete" ? "!" : "·"}</span><strong>{tool.name}</strong><small>{tool.status}{tool.elapsedMs ? ` · ${tool.elapsedMs} ms` : ""}</small></div>)}</div>}

          <form className="agent-composer" onSubmit={(event) => void submitMessage(event)}>
            <label className="agent-sr-only" htmlFor="agent-message">Ask LedgerLoop about receivables</label>
            <textarea id="agent-message" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={3} placeholder="Ask about invoices, collections, or business policies…" disabled={!props.databaseReady || busy} />
            <div className="agent-composer-bottom"><span>{text.length}/2,000 · Read-only analysis and draft preparation</span><button type="submit" className="button" disabled={!canChat || !text.trim()}>{busy ? "Working…" : "Ask LedgerLoop"}<span aria-hidden="true">→</span></button></div>
            <p className="agent-privacy-note">Relevant business records and your request are sent to Groq for analysis. Payment credentials are never sent. Review every draft before use.</p>
          </form>
        </section>

        <aside className="agent-side-column">
          <section className="agent-panel agent-approval-panel">
            <header className="agent-panel-head"><div><span className="agent-kicker">OWNER CONTROL</span><h2>Approvals</h2></div><span className="agent-count">{approvals.filter((approval) => ["pending", "executing"].includes(approval.status)).length}</span></header>
            {approvals.length === 0 ? <p className="agent-side-empty">Payment link requests will appear here for owner review.</p> : <div className="agent-approval-list">{approvals.map((approval) => (
              <article className="agent-approval-item" key={approval.id}>
                <div className="agent-approval-item-head"><strong>{approval.invoice_number}</strong><span className={`approval-status ${approval.status}`}>{approval.status}</span></div>
                <p>{approval.reason}</p>
                <small>Payment link · Requested {formatDateTime(approval.created_at)}</small>
                {approval.status === "pending" && <div className="agent-approval-actions"><button type="button" className="button small" onClick={() => void decideApproval(approval.id, "approve")}>Approve and prepare link</button><button type="button" className="button secondary small" onClick={() => void decideApproval(approval.id, "reject")}>Reject</button></div>}
                {approval.status === "executed" && paymentLinkFromResult(approval.result) && <a className="agent-payment-link" href={paymentLinkFromResult(approval.result) as string} target="_blank" rel="noreferrer">Open prepared PayPal link ↗</a>}
              </article>
            ))}</div>}
          </section>

          <section className="agent-panel agent-knowledge-panel">
            <header className="agent-panel-head"><div><span className="agent-kicker">BUSINESS KNOWLEDGE</span><h2>Policy library</h2></div><span className="agent-count">{documents.length}</span></header>
            <p className="agent-panel-copy">Add payment terms or collection guidance to ground drafts in your business rules.</p>
            <form className="agent-upload-form" onSubmit={(event) => void uploadDocument(event)}>
              <label htmlFor="policy-file">Document</label>
              <input ref={fileInput} id="policy-file" type="file" accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" disabled={!props.databaseReady || uploading} />
              <label htmlFor="policy-replace">Save as</label>
              <select id="policy-replace" value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)} disabled={!props.databaseReady || uploading}>
                <option value="">New policy document</option>
                {documents.map((document) => <option key={document.id} value={document.id}>Replace {document.name}</option>)}
              </select>
              <button type="submit" className="button secondary" disabled={!props.databaseReady || uploading}>{uploading ? "Extracting and indexing…" : selectedDocumentId ? "Update policy" : "Add policy"}</button>
              <small>Text, Markdown, or searchable PDF · up to 10 MB</small>
            </form>
            <div className="agent-document-list">{documents.map((document) => <div className="agent-document-row" key={document.id}><span className="agent-document-type">{document.mime_type === "application/pdf" ? "PDF" : document.mime_type === "text/markdown" ? "MD" : "TXT"}</span><div><strong>{document.name}</strong><small>{document.chunk_count} searchable sections · updated {formatDate(document.updated_at)}</small></div><button type="button" aria-label={`Delete ${document.name}`} onClick={() => void deleteDocument(document.id)} disabled={!props.databaseReady || uploading}>×</button></div>)}{documents.length === 0 && <p className="agent-side-empty">No policy documents added yet.</p>}</div>
          </section>

          <section className="agent-panel agent-activity-panel">
            <header className="agent-panel-head"><div><span className="agent-kicker">AUDIT TRAIL</span><h2>Recent agent activity</h2></div></header>
            {activity.length === 0 ? <p className="agent-side-empty">Tool activity appears here after a request is processed.</p> : <div className="agent-activity-list">{activity.slice(0, 8).map((item) => <div className="agent-activity-row" key={item.id}><span className={`agent-activity-dot ${item.status}`} aria-hidden="true" /><div><strong>{toolLabels[item.tool_name] ?? item.tool_name}</strong><small>{formatDateTime(item.created_at)}</small></div><span>{item.status === "completed" ? `${item.duration_ms ?? 0} ms` : item.status}</span></div>)}</div>}
          </section>
        </aside>
      </div>
    </main>
  );
}
