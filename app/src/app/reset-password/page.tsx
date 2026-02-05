"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) {
      setError("Missing recovery token.");
      return;
    }
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken || type !== "recovery") {
      setError("Invalid recovery link.");
      return;
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(() => setReady(true))
      .catch(() => setError("Failed to initialize recovery session."));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!password) {
      setError("Enter a new password.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatus("Password updated. You can log in now.");
    await supabase.auth.signOut();
    setTimeout(() => router.replace("/login"), 1500);
  };

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">Reset Password</div>
        <p className="page-subtitle">
          Set a new password to regain access.
        </p>
        {!ready && !error && <div className="status-inline">Checking link...</div>}
        {error && <div className="status-inline">{error}</div>}
        {ready && (
          <form className="panel" onSubmit={handleSubmit}>
            <label className="field">
              New password
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="New password"
              />
            </label>
            <div className="rating-actions">
              <button className="button" type="submit">
                Update password
              </button>
            </div>
            {status && <div className="status-inline">{status}</div>}
          </form>
        )}
      </main>
    </div>
  );
}
