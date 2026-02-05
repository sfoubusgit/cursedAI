import SiteHeader from "@/components/SiteHeader";

export default function TermsPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">Terms of Service</div>
        <p className="page-subtitle">Effective date: 31.01.2026</p>

        <div className="rules-list rules-ruled">
          <div className="rules-item">
            <strong>What cursedAI is.</strong> A public feed of AI-generated images
            and videos ordered by community ratings. Browsing and rating are
            anonymous. Uploading requires login.
          </div>
          <div className="rules-item">
            <strong>Your account.</strong> You are responsible for activity on your
            account. You can delete your account at any time.
          </div>
          <div className="rules-item">
            <strong>Uploads and ownership.</strong> You confirm you have the rights
            to what you upload and that it is AI-generated. You grant cursedAI a
            worldwide, non-exclusive, royalty-free license to host, display, and
            distribute your upload within the service.
          </div>
          <div className="rules-item">
            <strong>Prohibited content.</strong> No minors. No sexual violence. No
            extreme gore. No doxxing. No threats. No illegal content. No targeted
            harassment. Anything outside policy is removed.
          </div>
          <div className="rules-item">
            <strong>Moderation.</strong> We may hide or remove content at any time.
            Reports are reviewed. Removal is final unless explicitly restored.
          </div>
          <div className="rules-item">
            <strong>Ratings.</strong> Ratings apply only to the last viewed item.
            Ratings are aggregated and may influence ranking.
          </div>
          <div className="rules-item">
            <strong>Service availability.</strong> We may pause or end the service
            at any time. We make no guarantees about uptime, storage, or
            permanence.
          </div>
          <div className="rules-item">
            <strong>Liability.</strong> The service is provided "as is." We are not
            liable for user-generated content or service interruptions.
          </div>
          <div className="rules-item">
            <strong>Contact.</strong> Policy or takedown requests:
            <span> sfou.business@gmail.com</span>
          </div>
        </div>
      </main>
    </div>
  );
}
