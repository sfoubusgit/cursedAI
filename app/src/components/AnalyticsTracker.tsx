"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase, supabaseEnv } from "@/lib/supabaseClient";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) return;
    if (!pathname || loggedRef.current === pathname) return;

    const logView = async () => {
      const sessionId = localStorage.getItem("cursedai_session_id");
      loggedRef.current = pathname;
      await supabase.from("analytics_events").insert({
        session_id: sessionId,
        path: pathname,
        event_type: "page_view",
        meta: { referrer: document.referrer || null },
      });
    };

    logView();
  }, [pathname]);

  return null;
}
