import Link from "next/link";
import LandingConfirmToast from "@/components/LandingConfirmToast";
import SiteHeader from "@/components/SiteHeader";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ confirm?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const showConfirm = params?.confirm === "success";

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="landing">
      <LandingConfirmToast show={showConfirm} />
      <img
        className="landing-wordmark"
        src="/cursedai-wordmark.svg"
        alt="cursedAI"
      />
      <div className="landing-hero">
        <h1 className="landing-title">A collective descent into the wrong version of normal.</h1>
        <p className="landing-body">
          An infinite feed of AI-generated images and videos, ordered by
          community-rated cursedness. Depth resets each session.
        </p>
      </div>
      <div className="landing-cta">
        <Link href="/feed" className="landing-button">
          Enter the feed
        </Link>
        <div className="landing-hint">
          You will notice when it stops being normal.
        </div>
      </div>
      <div className="landing-rules">
        <div className="landing-rule">One item at a time.</div>
        <div className="landing-rule">Rate the last thing you saw.</div>
        <div className="landing-rule">Nothing is personalized.</div>
        <div className="landing-rule">Depth rises as you scroll.</div>
      </div>
      <div className="landing-footer">
        Uploads require login. Browsing and rating are anonymous.
      </div>
      </main>
    </div>
  );
}
