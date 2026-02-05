"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function AuthNav() {
  const [userLabel, setUserLabel] = useState<string | null>(null);

  const formatLabel = (user: { email?: string | null; user_metadata?: { username?: string } } | null) => {
    const metaName = typeof user?.user_metadata?.username === "string" ? user?.user_metadata?.username : "";
    if (metaName && metaName.trim()) return metaName.trim();
    const email = user?.email ?? "";
    return email ? email.split("@")[0] : "member";
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      setUserLabel(user ? formatLabel(user) : null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user ?? null;
        setUserLabel(user ? formatLabel(user) : null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!userLabel) {
    return (
      <Link href="/login" className="auth-link">
        Login
      </Link>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.href = "/feed?logout=success";
    }
  };

  return (
    <div className="auth-status">
      <span className="auth-label">Logged in as {userLabel}</span>
      <button className="auth-link" onClick={handleLogout} type="button">
        Logout
      </button>
    </div>
  );
}
