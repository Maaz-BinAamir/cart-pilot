"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/shop", label: "Shop" },
  { href: "/chat", label: "Ask Pilot" },
  { href: "/orders", label: "Orders" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return <header className="topbar">
    <Link href="/shop" className="brand"><span className="brand-mark" aria-hidden="true" /><strong>cart pilot<span className="brand-dot">.</span></strong></Link>
    <nav className="main-nav" aria-label="Primary">
      {navigation.map(({ href, label }) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
    </nav>
  </header>;
}
