"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AuthMode = "login" | "register";

type AuthPanelProps = {
  onAuthed?: () => void;
};

export default function AuthPanel({ onAuthed }: AuthPanelProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthStatus(null);
    setResetStatus(null);

    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }

    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setAuthStatus("You are in.");
      onAuthed?.();
      return;
    }

    if (!username.trim()) {
      setAuthError("Username is required.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: `${window.location.origin}/?confirm=success`,
      },
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuthStatus("Confirm from your email to finish. Check spam if delayed.");
  };

  const handleReset = async () => {
    setAuthError(null);
    setAuthStatus(null);
    setResetStatus(null);

    if (!email) {
      setAuthError("Enter your email to reset the password.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setResetStatus("Reset sent. The link expires. Check spam or retry later.");
  };

  return (
    <form className="panel" onSubmit={handleAuth}>
      <div className="panel-title">
        {authMode === "login" ? "Login" : "Register"}
      </div>
      {authMode === "register" && (
        <label className="field">
          Username
          <input
            className="input"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="short handle"
          />
        </label>
      )}
      <label className="field">
        Email
        <input
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@domain.com"
        />
      </label>
      <label className="field">
        Password
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 6 characters"
        />
      </label>
      <div className="rating-actions">
        <button className="button" type="submit">
          {authMode === "login" ? "Login" : "Register"}
        </button>
        <button
          className="button button-ghost"
          type="button"
          onClick={() =>
            setAuthMode((prev) => (prev === "login" ? "register" : "login"))
          }
        >
          {authMode === "login" ? "Need an account" : "Have an account"}
        </button>
      </div>
      {authMode === "login" && (
        <button className="button button-ghost" type="button" onClick={handleReset}>
          Forgot password
        </button>
      )}
      {authError && <div className="status-inline">{authError}</div>}
      {authStatus && <div className="status-inline">{authStatus}</div>}
      {resetStatus && <div className="status-inline">{resetStatus}</div>}
    </form>
  );
}
