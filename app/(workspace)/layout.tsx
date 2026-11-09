import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { requireWorkspace } from "@/lib/data/workspace";

export const dynamic = "force-dynamic";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/customers", label: "Customers", icon: "♧" },
  { href: "/invoices", label: "Invoices", icon: "▤" },
  { href: "/payments", label: "Payments", icon: "↗" },
];

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { business, email } = await requireWorkspace();
  const initial = business.name.trim().slice(0, 1).toUpperCase() || "L";

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map((item) => <Link className="nav-link" href={item.href} key={item.href}><span aria-hidden="true" className="nav-icon">{item.icon}</span>{item.label}</Link>)}
          <span className="nav-link" aria-disabled="true"><span aria-hidden="true" className="nav-icon">✦</span>Collections Agent<span className="coming">Day 3</span></span>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><strong>Built for clarity</strong><span>Know what is due, what is overdue, and what needs attention.</span></div>
          <div className="profile">
            <div className="avatar" aria-hidden="true">{initial}</div>
            <div className="profile-meta"><strong>{business.name}</strong><span>{email}</span></div>
            <form action={signOut}><button className="signout" type="submit" aria-label="Sign out">↗</button></form>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar"><span className="breadcrumb">Workspace <span aria-hidden="true">/</span> Ledger</span><div className="topbar-right"><span><i className="status-dot" />Secure workspace</span><span>{business.default_currency}</span></div></header>
        {children}
      </section>
    </div>
  );
}
