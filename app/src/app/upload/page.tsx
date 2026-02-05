"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import AuthPanel from "@/components/AuthPanel";
import { supabase, supabaseEnv } from "@/lib/supabaseClient";

export default function UploadPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadsEnabled, setUploadsEnabled] = useState(true);
  const [uploadMaxTotal, setUploadMaxTotal] = useState(0);
  const [uploadMaxMb, setUploadMaxMb] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [year, setYear] = useState("");
  const [aiGenerated, setAiGenerated] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setAuthError(
        "Supabase environment variables are missing. Check README setup steps."
      );
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) return;
    const loadSettings = async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      if (!data) return;
      data.forEach((item) => {
        if (item.key === "uploads_enabled") {
          setUploadsEnabled(Boolean(item.value));
        }
        if (item.key === "upload_max_total") {
          const numeric = Number(item.value);
          setUploadMaxTotal(Number.isNaN(numeric) ? 0 : numeric);
        }
        if (item.key === "upload_max_mb") {
          const numeric = Number(item.value);
          setUploadMaxMb(Number.isNaN(numeric) ? 0 : numeric);
        }
      });
    };
    loadSettings();
  }, []);


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError(null);
    setUploadStatus(null);

    if (!file) {
      setUploadError("Select a file first.");
      return;
    }
    if (uploadMaxMb > 0) {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > uploadMaxMb) {
        setUploadError(`File is too large. Max ${uploadMaxMb} MB.`);
        return;
      }
    }
    if (!modelName.trim()) {
      setUploadError("Model name is required.");
      return;
    }
    if (!aiGenerated) {
      setUploadError("AI-generated confirmation is required.");
      return;
    }
    if (!userId) {
      setUploadError("Login required to submit.");
      return;
    }

    if (uploadMaxTotal > 0) {
      const { count, error: countError } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true });
      if (countError) {
        setUploadError(`Upload check failed: ${countError.message}`);
        return;
      }
      if ((count ?? 0) >= uploadMaxTotal) {
        setUploadError("Uploads are capped right now. Try again later.");
        return;
      }
    }

    setIsUploading(true);

    const fileExt = file.name.split(".").pop() ?? "bin";
    const filePath = `uploads/${userId}/${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      setUploadError(`Upload failed: ${uploadError.message}`);
      setIsUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("media")
      .getPublicUrl(filePath);

    const kind = file.type.startsWith("video") ? "video" : "image";
    const yearValue = year.trim() ? Number(year.trim()) : null;
    const origin = `model: ${modelName}${
      prompt.trim() ? ` / prompt: ${prompt.trim()}` : ""
    }`;

    const { error: insertError } = await supabase.from("media").insert({
      asset_url: publicData.publicUrl,
      kind,
      caption: prompt.trim() ? prompt.trim() : null,
      origin,
      model_name: modelName.trim(),
      prompt: prompt.trim() ? prompt.trim() : null,
      year: Number.isFinite(yearValue) ? yearValue : null,
      ai_generated: aiGenerated,
    });

    if (insertError) {
      setUploadError(`Database insert failed: ${insertError.message}`);
      setIsUploading(false);
      return;
    }

    setUploadStatus("Submitted. It will surface near the top.");
    setFile(null);
    setModelName("");
    setPrompt("");
    setYear("");
    setAiGenerated(false);
    setIsUploading(false);
  };

  const handleDeleteAccount = async () => {
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setDeleteError("Missing Supabase environment.");
      return;
    }
    setDeleteError(null);
    setDeleteStatus(null);

    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Type DELETE to confirm.");
      return;
    }

    setDeleting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setDeleteError("Not authenticated.");
      setDeleting(false);
      return;
    }

    try {
      const response = await fetch(
        `${supabaseEnv.url}/functions/v1/deleteAccount`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseEnv.key,
          },
        }
      );
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message);
      }
      setDeleteStatus("Account deleted.");
      await supabase.auth.signOut();
      router.replace("/");
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Delete failed."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-title">Upload</div>
        <p className="page-subtitle">
          Upload requires login. Browsing and rating remain anonymous.
        </p>
        <p className="page-subtitle">
          AI-only media. Anything outside policy will be removed.
        </p>
        {authError && <div className="status-bar error">{authError}</div>}
        {!userId && <AuthPanel onAuthed={() => router.replace("/feed?login=success")} />}
        {userId && (
          <form className="panel" onSubmit={handleUpload}>
            <div className="panel-title">Submit media</div>
            {!uploadsEnabled && (
              <div className="status-inline">
                Uploads are closed for now.
              </div>
            )}
            <label className="field">
              File
              <input
                className="input"
                type="file"
                accept="image/*,video/*"
                onChange={(event) =>
                  setFile(event.target.files ? event.target.files[0] : null)
                }
                disabled={!uploadsEnabled}
              />
            </label>
            <label className="field">
              Model name
              <input
                className="input"
                type="text"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                placeholder="model identifier"
                disabled={!uploadsEnabled}
              />
            </label>
            <label className="field">
              Prompt (optional)
              <input
                className="input"
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="prompt text"
                disabled={!uploadsEnabled}
              />
            </label>
            <label className="field">
              Year (optional)
              <input
                className="input"
                type="number"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                placeholder="2024"
                disabled={!uploadsEnabled}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={aiGenerated}
                onChange={(event) => setAiGenerated(event.target.checked)}
                disabled={!uploadsEnabled}
              />
              I confirm this is AI-generated content.
            </label>
            <div className="rating-actions">
              <button
                className="button"
                type="submit"
                disabled={isUploading || !uploadsEnabled}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
            {uploadError && <div className="status-inline">{uploadError}</div>}
            {uploadStatus && (
              <div className="status-inline">{uploadStatus}</div>
            )}
          </form>
        )}
        {userId && (
          <div className="panel panel-danger">
            <div className="panel-title">Delete account</div>
            <p className="page-subtitle">
              This removes your account permanently. Uploads remain in the feed.
            </p>
            <label className="field">
              Type DELETE to confirm
              <input
                className="input"
                type="text"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="DELETE"
              />
            </label>
            <div className="rating-actions">
              <button
                className="button button-danger"
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
            {deleteError && <div className="status-inline">{deleteError}</div>}
            {deleteStatus && <div className="status-inline">{deleteStatus}</div>}
          </div>
        )}
      </main>
    </div>
  );
}
