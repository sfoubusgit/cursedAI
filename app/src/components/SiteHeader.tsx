import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import AdminNav from "@/components/AdminNav";

const links = [
  { href: "/feed", label: "Feed", className: "nav-link nav-link-feed" },
  { href: "/upload", label: "Upload" },
  { href: "/graveyard", label: "Graveyard" },
  { href: "/rules", label: "Rules" },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="auth-ghost">
        <AuthNav />
      </div>
      <div className="brand-block">
        <Link href="/feed" className="brand-mark-link">
          <span className="brand-text">
            <span className="brand-text-muted">cursed</span>
            <span className="brand-text-strong">AI</span>
          </span>
        </Link>
      </div>
      <nav className="site-nav" aria-label="Primary">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={link.className}
          >
            {link.label}
          </Link>
        ))}
        <details className="nav-legal">
          <summary>Legal</summary>
          <div className="nav-legal-menu">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/dmca">DMCA</Link>
          </div>
        </details>
        <AdminNav />
      </nav>
    </header>
  );
}
