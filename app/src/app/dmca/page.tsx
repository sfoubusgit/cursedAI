import SiteHeader from "@/components/SiteHeader";

export default function DmcaPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">DMCA / Takedown</div>
        <p className="page-subtitle">Effective date: 31.01.2026</p>

        <div className="rules-list rules-ruled">
          <div className="rules-item">
            If you believe content infringes your rights, send a takedown notice
            to <span>sfou.business@gmail.com</span>.
          </div>
          <div className="rules-item">
            Include your name and contact information, the exact URL(s), a
            statement that you own the rights or are authorized to act, a good-
            faith statement that the use is unauthorized, and your signature
            (typed is acceptable).
          </div>
          <div className="rules-item">
            We will review and remove content when required by law.
          </div>
        </div>
      </main>
    </div>
  );
}
