"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LandingConfirmToastProps = {
  show: boolean;
};

export default function LandingConfirmToast({ show }: LandingConfirmToastProps) {
  const [open, setOpen] = useState(show);

  useEffect(() => {
    if (show) return;
    if (typeof window === "undefined") return;
    const already = sessionStorage.getItem("cursedai_confirm_toast_shown");
    if (already) return;

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const confirmedAt = (user as { email_confirmed_at?: string | null; confirmed_at?: string | null }).email_confirmed_at
        ?? (user as { confirmed_at?: string | null }).confirmed_at;
      if (!confirmedAt) return;
      const confirmedMs = new Date(confirmedAt).getTime();
      if (Number.isNaN(confirmedMs)) return;
      const elapsed = Date.now() - confirmedMs;
      if (elapsed > 5 * 60 * 1000) return;
      sessionStorage.setItem("cursedai_confirm_toast_shown", "1");
      setOpen(true);
    });
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setOpen(false), 10000);
    const url = new URL(window.location.href);
    url.searchParams.delete("confirm");
    window.history.replaceState({}, "", url.toString());
    return () => clearTimeout(timer);
  }, [show]);

  if (!open) return null;

  return (
    <div className="toast toast-auth landing-toast" role="status">
      <span>You successfully created your account.</span>
      <button
        className="toast-close"
        type="button"
        aria-label="Dismiss confirmation message"
        onClick={() => setOpen(false)}
      >
        X
      </button>
    </div>
  );
}
