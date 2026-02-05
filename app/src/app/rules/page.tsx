import SiteHeader from "@/components/SiteHeader";

export default function RulesPage() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">Rules</div>
        <div className="lexicon rules-lexicon">
          <div className="lexicon-term">cursed</div>
          <div className="lexicon-phonetic">/kɜːrst/</div>
          <div className="lexicon-tag">adj.</div>
          <div className="lexicon-definition">
            Whatever the viewer recognizes as wrong. The feed keeps a shared
            record of those recognitions and orders itself accordingly.
          </div>
          <div className="lexicon-notes">
            A collective definition, not a fixed one. The line moves as people
            rate.
          </div>
        </div>
        <p className="page-subtitle">
          The feed only works if it stays narrow. These rules keep it narrow.
        </p>
        <div className="rules-list rules-ruled">
          <div className="rules-item">AI-only media.</div>
          <div className="rules-item">
            No sexual violence, minors, extreme gore, doxxing, threats, illegal
            content, or targeted harassment.
          </div>
          <div className="rules-item">
            Report anything that violates the policy.
          </div>
          <div className="rules-item">
            Ratings apply to the last viewed item—never the experience.
          </div>
          <div className="rules-item">
            Hidden or removed items disappear immediately.
          </div>
          <div className="rules-item">
            The feed is shared. No personalization in v1.
          </div>
        </div>
        <div className="faq">
          <div className="faq-title">FAQ</div>
          <div className="faq-item">
            <div className="faq-question">What does “cursed” mean here?</div>
            <div className="faq-answer">
              It is a narrow band of wrongness: calm, uncanny, and slightly
              contemptible. Not horror. Not comedy.
            </div>
          </div>
          <div className="faq-item">
            <div className="faq-question">Why am I asked to rate?</div>
            <div className="faq-answer">
              Ratings order the feed. They apply to the last viewed item only.
            </div>
          </div>
          <div className="faq-item">
            <div className="faq-question">Is the feed personalized?</div>
            <div className="faq-answer">
              No. Everyone sees the same shared descent in v1.
            </div>
          </div>
          <div className="faq-item">
            <div className="faq-question">What happens to low-cursed items?</div>
            <div className="faq-answer">
              They drift to the graveyard once confidence is high enough.
            </div>
          </div>
          <div className="faq-item">
            <div className="faq-question">Do you store my ratings?</div>
            <div className="faq-answer">
              Yes, but only by anonymous session. No profile is required.
            </div>
          </div>
          <div className="faq-item">
            <div className="faq-question">How do I delete my account?</div>
            <div className="faq-answer">
              Go to Upload while logged in. Use the Delete account section and
              confirm with DELETE.
            </div>
          </div>
        </div>
          <div className="faq-item">
            <div className="faq-question">Where do I report legal issues?</div>
            <div className="faq-answer">
              DMCA and policy requests go to sfou.business@gmail.com. Details are
              in the DMCA page.
            </div>
          </div>
        <div className="panel">
          <div className="panel-title">Policy & Takedown</div>
          <p className="page-subtitle">
            Read the policy pages before uploading or sharing.
          </p>
          <div className="rules-list">
            <div className="rules-item">Terms: /terms</div>
            <div className="rules-item">Privacy: /privacy</div>
            <div className="rules-item">DMCA: /dmca</div>
          </div>
        </div>
      </main>
    </div>
  );
}
