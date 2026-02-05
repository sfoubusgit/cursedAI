import SiteHeader from "@/components/SiteHeader";

export default function PrivacyPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">Privacy Policy</div>
        <p className="page-subtitle">Effective date: 31.01.2026</p>

        <div className="rules-list rules-ruled">
          <div className="rules-item">
            <strong>What we collect.</strong> Account email (if you register),
            session ID (anonymous browsing/rating), upload metadata (model name,
            prompt, year), reports you submit, and basic device info (user agent).
          </div>
          <div className="rules-item">
            <strong>How we use it.</strong> To deliver the feed, prevent duplicate
            ratings, moderate reports, and maintain service integrity.
          </div>
          <div className="rules-item">
            <strong>What we don't do.</strong> We don't sell personal data. We don't
            do personalized feeds in v1.
          </div>
          <div className="rules-item">
            <strong>Storage.</strong> Uploads are stored on Supabase. Ratings and
            sessions are stored in our database.
          </div>
          <div className="rules-item">
            <strong>Deletion.</strong> You can delete your account. Uploaded content
            remains unless removed by moderation.
          </div>
          <div className="rules-item">
            <strong>Contact.</strong> Privacy requests: <span>sfou.business@gmail.com</span>
          </div>
        </div>
      </main>
    </div>
  );
}
