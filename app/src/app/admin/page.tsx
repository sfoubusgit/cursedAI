"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { supabase, supabaseEnv } from "@/lib/supabaseClient";

type AdminMediaItem = {
  id: string;
  kind: "image" | "video";
  asset_url: string;
  caption: string | null;
  origin: string | null;
  model_name: string | null;
  prompt: string | null;
  year: number | null;
  ai_generated: boolean;
  rating_count: number;
  score: number;
  confidence: number;
  status: string;
  is_hidden: boolean;
};

type AdminReport = {
  id: string;
  created_at: string;
  reason: string;
  details: string | null;
  media_asset_url: string | null;
  media_kind: string | null;
  media_caption: string | null;
  status: string;
  resolution_note: string | null;
  media: AdminMediaItem | null;
};

type AdminUser = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
};

type AdminFeedback = {
  id: string;
  created_at: string;
  score: number;
  notes: string | null;
  session_id: string | null;
};


type SettingsMap = {
  ads_enabled: boolean;
  ad_milestones: number[];
  ad_cooldown_seconds: number;
  uploads_enabled: boolean;
  upload_max_total: number;
  upload_max_mb: number;
  ratings_enabled: boolean;
  reports_enabled: boolean;
};

const defaultSettings: SettingsMap = {
  ads_enabled: true,
  ad_milestones: [25, 50, 75],
  ad_cooldown_seconds: 120,
  uploads_enabled: true,
  upload_max_total: 0,
  upload_max_mb: 0,
  ratings_enabled: true,
  reports_enabled: true,
};

const pageSize = 10;
const adminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean) ?? [];

export default function AdminPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"moderation" | "reports" | "admins" | "settings" | "backup" | "feedback">(
    "moderation"
  );

  const [mediaItems, setMediaItems] = useState<AdminMediaItem[]>([]);
  const [mediaPage, setMediaPage] = useState(0);
  const [mediaHasMore, setMediaHasMore] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaStatusFilter, setMediaStatusFilter] = useState("active");
  const [mediaSearch, setMediaSearch] = useState("");

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportStatus, setReportStatus] = useState("open");
  const [reportLoading, setReportLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [adminRoleInput, setAdminRoleInput] = useState("admin");
  const [adminLoading, setAdminLoading] = useState(false);

  const [feedbackItems, setFeedbackItems] = useState<AdminFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [settings, setSettings] = useState<SettingsMap>(defaultSettings);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportAllTime, setExportAllTime] = useState(false);
  const [exportLimit, setExportLimit] = useState(25);
  const [exportPage, setExportPage] = useState(1);
  const [autoAdvanceExport, setAutoAdvanceExport] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeLoading, setWipeLoading] = useState(false);
  const [settingsDraft, setSettingsDraft] =
    useState<SettingsMap>(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const allowlistMatch = useMemo(() => {
    if (!userEmail) return false;
    return adminEmails.includes(userEmail.toLowerCase());
  }, [userEmail]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserEmail(session?.user.email ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    if (allowlistMatch) {
      setIsAdmin(true);
      setAdminChecked(true);
      return;
    }
    const verify = async () => {
      try {
        await invokeAdmin("adminUsers", { action: "list" });
        setIsAdmin(true);
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminChecked(true);
      }
    };
    verify();
  }, [userEmail, allowlistMatch]);

  const invokeAdmin = async <T,>(
    fn: "adminMedia" | "adminReports" | "adminUsers" | "adminSettings" | "adminWipe" | "adminExport" | "adminFeedback",
    body: Record<string, unknown>
  ) => {
    if (!supabaseEnv.url || !supabaseEnv.key) {
      throw new Error("Missing Supabase environment.");
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("Not authenticated.");
    }
    const response = await fetch(`${supabaseEnv.url}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseEnv.key,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Admin request failed: ${response.status} ${message}`);
    }
    return (await response.json()) as T;
  };

  const loadMedia = async (reset = false) => {
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setFeedError(
        "Supabase environment variables are missing. Check README setup steps."
      );
      return;
    }
    if (mediaLoading || (!mediaHasMore && !reset)) return;
    setFeedError(null);
    setMediaLoading(true);

    const nextPage = reset ? 0 : mediaPage;
    try {
      const response = await invokeAdmin<{ data: AdminMediaItem[] }>(
        "adminMedia",
        {
          action: "list",
          page: nextPage,
          pageSize,
          status: mediaStatusFilter || undefined,
          search: mediaSearch || undefined,
        }
      );

      const rows = response?.data ?? [];
      setMediaItems((prev) => (reset ? rows : [...prev, ...rows]));
      setMediaPage(nextPage + 1);
      setMediaHasMore(rows.length === pageSize);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    } finally {
      setMediaLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "moderation") {
      loadMedia(true);
    }
  }, [isAdmin, tab, mediaStatusFilter]);

  const updateMedia = async (mediaId: string, updates: Partial<AdminMediaItem>) => {
    setFeedError(null);
    await invokeAdmin("adminMedia", {
      action: "update",
      media_id: mediaId,
      updates,
    });
    setMediaItems((prev) =>
      prev.map((item) => (item.id === mediaId ? { ...item, ...updates } : item))
    );
    setStatusMessage("Update applied.");
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const loadReports = async () => {
    if (reportLoading) return;
    setFeedError(null);
    setReportLoading(true);
    try {
      const response = await invokeAdmin<{ data: AdminReport[] }>(
        "adminReports",
        {
          action: "list",
          page: 0,
          pageSize: 50,
          status: reportStatus || undefined,
        }
      );
      setReports(response.data ?? []);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    } finally {
      setReportLoading(false);
    }
  };

  const loadFeedback = async () => {
    if (feedbackLoading) return;
    setFeedError(null);
    setFeedbackLoading(true);
    try {
      const response = await invokeAdmin<{ data: AdminFeedback[] }>(
        "adminFeedback",
        {
          action: "list",
          page: 0,
          pageSize: 50,
        }
      );
      setFeedbackItems(response.data ?? []);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    } finally {
      setFeedbackLoading(false);
    }
  };

  const resolveReport = async (
    reportId: string,
    mediaUpdate?: { media_id: string; updates: Record<string, unknown> }
  ) => {
    await invokeAdmin("adminReports", {
      action: "resolve",
      report_id: reportId,
      resolution_note: "Resolved in admin.",
      media_update: mediaUpdate,
    });
    setReports((prev) =>
      prev.map((report) =>
        report.id === reportId ? { ...report, status: "resolved" } : report
      )
    );
    setStatusMessage("Report resolved.");
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const loadAdminUsers = async () => {
    setAdminLoading(true);
    try {
      const response = await invokeAdmin<{ data: AdminUser[] }>("adminUsers", {
        action: "list",
      });
      setAdminUsers(response.data ?? []);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  const addAdminUser = async () => {
    if (!adminEmailInput) return;
    try {
      await invokeAdmin("adminUsers", {
        action: "add_by_email",
        email: adminEmailInput,
        role: adminRoleInput,
      });
      setAdminEmailInput("");
      await loadAdminUsers();
      setStatusMessage("Admin user added.");
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    }
  };

  const removeAdminUser = async (userId: string) => {
    try {
      await invokeAdmin("adminUsers", { action: "remove", user_id: userId });
      setAdminUsers((prev) => prev.filter((user) => user.user_id !== userId));
      setStatusMessage("Admin user removed.");
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await invokeAdmin<{
        data: { key: string; value: unknown }[];
      }>("adminSettings", { action: "list" });
      const nextSettings = { ...defaultSettings };
      response.data?.forEach((item) => {
        if (item.key in nextSettings) {
          (nextSettings as Record<string, unknown>)[item.key] = item.value;
        }
      });
      setSettings(nextSettings);
      setSettingsDraft(nextSettings);
      setSettingsDirty(false);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSetting = async (
    key: keyof SettingsMap,
    value: unknown,
    silent = false
  ) => {
    try {
      await invokeAdmin("adminSettings", {
        action: "update",
        key,
        value,
      });
      setSettings((prev) => ({ ...prev, [key]: value }));
      if (!silent) {
        setStatusMessage("Settings saved.");
        setTimeout(() => setStatusMessage(null), 2000);
      }
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Admin request failed."
      );
    }
  };

  const updateSettingsDraft = (key: keyof SettingsMap, value: unknown) => {
    setSettingsDraft((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const handleExport = async () => {
    if (exportLoading) return;
    if (!exportAllTime && (!exportFrom || !exportTo)) {
      setFeedError("Select a from/to date or choose all time.");
      return;
    }
    setFeedError(null);
    setExportLoading(true);
    try {
      if (!supabaseEnv.url || !supabaseEnv.key) {
        throw new Error("Missing Supabase environment.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Not authenticated.");
      }
      const response = await fetch(`${supabaseEnv.url}/functions/v1/adminExport`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseEnv.key,
        },
        body: JSON.stringify({
          from: exportFrom,
          to: exportTo,
          all_time: exportAllTime,
          limit: exportLimit,
          page: exportPage,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Export failed: ${message}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const suffix = `page-${exportPage}-limit-${exportLimit}.zip`;
      link.download = exportAllTime
        ? `cursedai-export-all-time-${suffix}`
        : `cursedai-export-${exportFrom}-to-${exportTo}-${suffix}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Export ready.");
      setTimeout(() => setStatusMessage(null), 2000);
      if (autoAdvanceExport) {
        setExportPage((prev) => prev + 1);
      }
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleWipe = async (mode: "media_only" | "media_and_ratings") => {
    if (wipeLoading) return;
    if (wipeConfirm.trim().toUpperCase() !== "WIPE ALL MEDIA") {
      setFeedError("Type WIPE ALL MEDIA to confirm.");
      return;
    }
    setFeedError(null);
    setWipeLoading(true);
    try {
      await invokeAdmin("adminWipe", { action: mode });
      setStatusMessage(
        mode === "media_only"
          ? "Media wiped."
          : "Media, ratings, and reports wiped."
      );
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : "Wipe failed."
      );
    } finally {
      setWipeLoading(false);
    }
  };

  const saveAllSettings = async () => {
    const entries = Object.entries(settingsDraft) as [
      keyof SettingsMap,
      SettingsMap[keyof SettingsMap]
    ][];
    const pending = entries.filter(([key, value]) => {
      const current = settings[key];
      return JSON.stringify(current) !== JSON.stringify(value);
    });
    if (!pending.length) {
      setSettingsDirty(false);
      setStatusMessage("No changes.");
      setTimeout(() => setStatusMessage(null), 2000);
      return;
    }
    setSettingsLoading(true);
    try {
      for (const [key, value] of pending) {
        await saveSetting(key, value, true);
      }
      setStatusMessage("Settings saved.");
      setTimeout(() => setStatusMessage(null), 2000);
      setSettingsDirty(false);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "reports") {
      loadReports();
    }
    if (tab === "admins") {
      loadAdminUsers();
    }
    if (tab === "feedback") {
      loadFeedback();
    }
    if (tab === "settings") {
      loadSettings();
    }
  }, [tab, isAdmin, reportStatus]);

  if (!adminChecked || !isAdmin) {
    return (
      <div className="app-shell">
        <SiteHeader />
        <main className="page-shell">
          <div className="page-title">Admin</div>
          <p className="page-subtitle">
            Restricted. Check `NEXT_PUBLIC_ADMIN_EMAILS` and login credentials.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-shell">
        <div className="page-shell">
          <div className="page-title">Admin</div>
          <p className="page-subtitle">
            Moderation and system controls. Admin access enforced server-side.
          </p>
        </div>
        {feedError && <div className="status-bar error">{feedError}</div>}
        <div className="admin-tabs">
          <button
            className={`button button-ghost ${tab === "moderation" ? "is-active" : ""}`}
            onClick={() => setTab("moderation")}
          >
            Moderation
          </button>
          <button
            className={`button button-ghost ${tab === "reports" ? "is-active" : ""}`}
            onClick={() => setTab("reports")}
          >
            Reports
          </button>
          <button
            className={`button button-ghost ${tab === "admins" ? "is-active" : ""}`}
            onClick={() => setTab("admins")}
          >
            Admins
          </button>
          <button
            className={`button button-ghost ${tab === "settings" ? "is-active" : ""}`}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
          <button
            className={`button button-ghost ${tab === "backup" ? "is-active" : ""}`}
            onClick={() => setTab("backup")}
          >
            Backup
          </button>
          <button
            className={`button button-ghost ${tab === "feedback" ? "is-active" : ""}`}
            onClick={() => setTab("feedback")}
          >
            Feedback
          </button>
        </div>

        {tab === "moderation" && (
          <>
            <div className="admin-filters">
              <label className="field">
                Status
                <select
                  className="input"
                  value={mediaStatusFilter}
                  onChange={(event) => setMediaStatusFilter(event.target.value)}
                >
                  <option value="active">active</option>
                  <option value="graveyard">graveyard</option>
                  <option value="removed">removed</option>
                </select>
              </label>
              <label className="field">
                Search
                <input
                  className="input"
                  type="text"
                  value={mediaSearch}
                  onChange={(event) => setMediaSearch(event.target.value)}
                  placeholder="caption or model"
                />
              </label>
              <button className="button" onClick={() => loadMedia(true)}>
                Refresh
              </button>
            </div>
            {mediaItems.map((item) => (
              <article key={item.id} className="media-item">
                <div className="media-frame">
                  {item.kind === "image" ? (
                    <img src={item.asset_url} alt={item.caption ?? "Media item"} />
                  ) : (
                    <video
                      src={item.asset_url}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  )}
                </div>
                <div className="media-meta">
                  <div className="media-caption">
                    {item.caption ?? "Unlabeled media."}
                  </div>
                  <div>{item.origin ?? "model: unknown"}</div>
                  <div>
                    Score: {Math.round(item.score)} | Confidence:{" "}
                    {item.confidence.toFixed(2)} | Ratings: {item.rating_count}
                  </div>
                  <div>Status: {item.status}</div>
                  <div>Hidden: {item.is_hidden ? "yes" : "no"}</div>
                  <div className="rating-actions">
                    <button
                      className="button"
                      onClick={() =>
                        updateMedia(item.id, { is_hidden: !item.is_hidden })
                      }
                    >
                      {item.is_hidden ? "Unhide" : "Hide"}
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={() =>
                        updateMedia(item.id, {
                          status: item.status === "removed" ? "active" : "removed",
                        })
                      }
                    >
                      {item.status === "removed" ? "Restore" : "Remove"}
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={() =>
                        updateMedia(item.id, {
                          status: item.status === "graveyard" ? "active" : "graveyard",
                        })
                      }
                    >
                      {item.status === "graveyard" ? "Restore" : "Graveyard"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {mediaLoading && <div className="status-inline">Loading...</div>}
            {mediaHasMore && !mediaLoading && (
              <button className="button" onClick={() => loadMedia()}>
                Load more
              </button>
            )}
          </>
        )}

        {tab === "reports" && (
          <>
            <div className="admin-filters">
              <label className="field">
                Status
                <select
                  className="input"
                  value={reportStatus}
                  onChange={(event) => setReportStatus(event.target.value)}
                >
                  <option value="open">open</option>
                  <option value="resolved">resolved</option>
                </select>
              </label>
              <button className="button" onClick={loadReports}>
                Refresh
              </button>
            </div>
            {reports.map((report) => (
              <article key={report.id} className="report-card">
                <div className="report-row">
                  <div>Reason: {report.reason}</div>
                  <div>Status: {report.status}</div>
                </div>
                {report.details && <div>Notes: {report.details}</div>}
                <div className="report-row">
                  <span>
                    {report.media?.caption ??
                      report.media_caption ??
                      "Media unavailable."}
                  </span>
                  <span>{report.media?.status ?? "missing"}</span>
                </div>
                {(report.media?.asset_url || report.media_asset_url) && (
                  <div className="media-frame">
                    {(
                      report.media?.kind ??
                      report.media_kind
                    ) === "video" ? (
                      <video
                        src={report.media?.asset_url ?? report.media_asset_url ?? ""}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={report.media?.asset_url ?? report.media_asset_url ?? ""}
                        alt={
                          report.media?.caption ??
                          report.media_caption ??
                          "Reported media"
                        }
                      />
                    )}
                  </div>
                )}
                <div className="rating-actions">
                  <button
                    className="button"
                    onClick={() =>
                      resolveReport(report.id, {
                        media_id: report.media?.id ?? "",
                        updates: { is_hidden: true },
                      })
                    }
                  >
                    Hide + Resolve
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={() =>
                      resolveReport(report.id, {
                        media_id: report.media?.id ?? "",
                        updates: { status: "removed" },
                      })
                    }
                  >
                    Remove + Resolve
                  </button>
                  <button
                    className="button button-ghost"
                    onClick={() => resolveReport(report.id)}
                  >
                    Resolve only
                  </button>
                </div>
              </article>
            ))}
            {reportLoading && <div className="status-inline">Loading...</div>}
          </>
        )}

        {tab === "admins" && (
          <>
            <div className="admin-filters">
              <label className="field">
                Email
                <input
                  className="input"
                  type="email"
                  value={adminEmailInput}
                  onChange={(event) => setAdminEmailInput(event.target.value)}
                  placeholder="admin email"
                />
              </label>
              <label className="field">
                Role
                <input
                  className="input"
                  type="text"
                  value={adminRoleInput}
                  onChange={(event) => setAdminRoleInput(event.target.value)}
                />
              </label>
              <button className="button" onClick={addAdminUser}>
                Add admin
              </button>
            </div>
            {adminUsers.map((admin) => (
              <div key={admin.user_id} className="report-card">
                <div className="report-row">
                  <span>{admin.email}</span>
                  <span>{admin.role}</span>
                </div>
                <button
                  className="button button-ghost"
                  onClick={() => removeAdminUser(admin.user_id)}
                >
                  Remove
                </button>
              </div>
            ))}
            {adminLoading && <div className="status-inline">Loading...</div>}
          </>
        )}

        {tab === "settings" && (
          <>
            <div className="admin-filters">
              <div className="page-subtitle">
                Changes are saved when you press Save.
              </div>
              <button
                className="button"
                onClick={saveAllSettings}
                disabled={settingsLoading}
              >
                {settingsLoading ? "Saving..." : "Save settings"}
              </button>
            </div>
            <div className="admin-settings-grid">
              <label className="field">
                Ads enabled
                <select
                  className="input"
                  value={settingsDraft.ads_enabled ? "on" : "off"}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "ads_enabled",
                      event.target.value === "on"
                    )
                  }
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
              <label className="field">
                Ad milestones
                <input
                  className="input"
                  type="text"
                  value={settingsDraft.ad_milestones.join(",")}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "ad_milestones",
                      event.target.value
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter((value) => !Number.isNaN(value))
                    )
                  }
                />
              </label>
              <label className="field">
                Ad cooldown (seconds)
                <input
                  className="input"
                  type="number"
                  value={settingsDraft.ad_cooldown_seconds}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "ad_cooldown_seconds",
                      Number(event.target.value)
                    )
                  }
                />
              </label>
              <label className="field">
                Uploads enabled
                <select
                  className="input"
                  value={settingsDraft.uploads_enabled ? "on" : "off"}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "uploads_enabled",
                      event.target.value === "on"
                    )
                  }
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
              <label className="field">
                Upload max total (0 = unlimited)
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={settingsDraft.upload_max_total}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "upload_max_total",
                      Math.max(0, Number(event.target.value))
                    )
                  }
                />
              </label>
              <label className="field">
                Upload max size (MB, 0 = unlimited)
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  value={settingsDraft.upload_max_mb}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "upload_max_mb",
                      Math.max(0, Number(event.target.value))
                    )
                  }
                />
              </label>
              <label className="field">
                Ratings enabled
                <select
                  className="input"
                  value={settingsDraft.ratings_enabled ? "on" : "off"}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "ratings_enabled",
                      event.target.value === "on"
                    )
                  }
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
              <label className="field">
                Reports enabled
                <select
                  className="input"
                  value={settingsDraft.reports_enabled ? "on" : "off"}
                  onChange={(event) =>
                    updateSettingsDraft(
                      "reports_enabled",
                      event.target.value === "on"
                    )
                  }
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </select>
              </label>
            </div>
            {settingsLoading && <div className="status-inline">Loading...</div>}
            <div className="panel panel-danger">
              <div className="panel-title">Danger Zone</div>
              <p className="page-subtitle">
                Wipe actions remove content from the feed and storage. Export
                a backup first. This cannot be undone.
              </p>
              <label className="field">
                Type WIPE ALL MEDIA to confirm
                <input
                  className="input"
                  type="text"
                  value={wipeConfirm}
                  onChange={(event) => setWipeConfirm(event.target.value)}
                  placeholder="WIPE ALL MEDIA"
                />
              </label>
              <div className="rating-actions">
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => handleWipe("media_only")}
                  disabled={wipeLoading}
                >
                  {wipeLoading ? "Working..." : "Wipe media only (ratings will also be removed due to FK)"}
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => handleWipe("media_and_ratings")}
                  disabled={wipeLoading}
                >
                  {wipeLoading ? "Working..." : "Wipe media + ratings + reports"}
                </button>
              </div>
            </div>

          </>
        )}

        {tab === "backup" && (
          <>
            <div className="panel">
              <div className="panel-title">Backup export</div>
              <p className="page-subtitle">
                Download a zip of media + metadata.json for a date range. Keep
                exports small (25 items max) to avoid timeouts.
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={exportAllTime}
                  onChange={(event) => setExportAllTime(event.target.checked)}
                />
                All time
              </label>
              <label className="field">
                From
                <input
                  className="input"
                  type="date"
                  value={exportFrom}
                  onChange={(event) => setExportFrom(event.target.value)}
                  disabled={exportAllTime}
                />
              </label>
              <label className="field">
                To
                <input
                  className="input"
                  type="date"
                  value={exportTo}
                  onChange={(event) => setExportTo(event.target.value)}
                  disabled={exportAllTime}
                />
              </label>
              <label className="field">
                Max items per export
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={25}
                  value={exportLimit}
                  onChange={(event) =>
                    setExportLimit(
                      Math.min(25, Math.max(1, Number(event.target.value)))
                    )
                  }
                />
              </label>
              <label className="field">
                Page
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={exportPage}
                  onChange={(event) =>
                    setExportPage(Math.max(1, Number(event.target.value)))
                  }
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={autoAdvanceExport}
                  onChange={(event) => setAutoAdvanceExport(event.target.checked)}
                />
                Auto-advance page after download
              </label>
              <div className="rating-actions">
                <button
                  className="button"
                  type="button"
                  onClick={handleExport}
                  disabled={exportLoading}
                >
                  {exportLoading ? "Preparing..." : "Download backup"}
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "feedback" && (
          <>
            <div className="admin-filters">
              <button className="button" onClick={loadFeedback}>
                Refresh
              </button>
            </div>
            {feedbackItems.length === 0 && !feedbackLoading && (
              <div className="status-inline">No feedback logged yet.</div>
            )}
            {feedbackItems.map((entry) => (
              <div key={entry.id} className="report-card">
                <div className="report-row">
                  <span>Score: {entry.score}</span>
                  <span>{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                <div>{entry.notes || "No notes provided."}</div>
                <div className="report-row">
                  <span>Session</span>
                  <span>{entry.session_id ?? "anonymous"}</span>
                </div>
              </div>
            ))}
            {feedbackLoading && <div className="status-inline">Loading...</div>}
          </>
        )}

        {statusMessage && <div className="toast">{statusMessage}</div>}
      </main>
    </div>
  );
}
