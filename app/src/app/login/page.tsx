"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import AuthPanel from "@/components/AuthPanel";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        router.replace("/feed");
      }
    });
  }, [router]);

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">Login</div>
        <p className="page-subtitle">
          Access is required for uploads. Browsing and rating remain anonymous.
        </p>
        <AuthPanel onAuthed={() => router.replace("/feed?login=success")} />
      </main>
    </div>
  );
}
