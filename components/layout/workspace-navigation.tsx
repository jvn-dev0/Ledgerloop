"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/customers", label: "Customers", icon: "customers" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
  { href: "/payments", label: "Payments", icon: "payments" },
  { href: "/assistant", label: "Collections", icon: "agent" },
] as const;

export function WorkspaceNavigation() {
  const pathname = usePathname();
  return (
    <nav className="nav-list" aria-label="Main navigation">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link className={`nav-link${active ? " active" : ""}`} href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ name }: { name: (typeof items)[number]["icon"] }) {
  const paths = {
    dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>,
    customers: <><circle cx="9" cy="8" r="3.25" /><path d="M3.5 20c.3-3.3 2.2-5 5.5-5s5.2 1.7 5.5 5" /><path d="M16 5.2a3.3 3.3 0 0 1 0 6.3M17 15c2.1.6 3.3 2.1 3.5 4.5" /></>,
    invoices: <><path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M14 3.5v4h4M8 12h8M8 16h8" /></>,
    payments: <><path d="M4 8h13.5a2.5 2.5 0 0 1 0 5H9a2.5 2.5 0 0 0 0 5h11" /><path d="m14 4 4 4-4 4M16 14l4 4-4 4" /></>,
    agent: <><path d="M12 3.5v3M5 7.5h14v11H5z" /><path d="M8 12h.01M16 12h.01M9 15c.8.7 1.8 1 3 1s2.2-.3 3-1" /><path d="M3.5 11v4M20.5 11v4" /></>,
  };

  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
