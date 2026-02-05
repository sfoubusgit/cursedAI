"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { supabase, supabaseEnv } from "@/lib/supabaseClient";

type MediaItem = {
  id: string;
  kind: "image" | "video";
  asset_url: string;
  caption: string | null;
  origin: string | null;
  rating_count: number;
  score: number;
  confidence: number;
};

type AppSettings = {
  ads_enabled: boolean;
  ad_milestones: number[];
  ad_cooldown_seconds: number;
  ratings_enabled: boolean;
  reports_enabled: boolean;
};

const defaultSettings: AppSettings = {
  ads_enabled: true,
  ad_milestones: [25, 50, 75],
  ad_cooldown_seconds: 120,
  ratings_enabled: true,
  reports_enabled: true,
};

const reportReasons = [
  "not_ai",
  "gore",
  "sexual_violence",
  "harassment",
  "doxxing",
  "illegal",
  "other",
];

const randomPromptStep = () => 5 + Math.floor(Math.random() * 8);
const pageSize = 8;

export default function Home() {
  return (
    <Suspense
      fallback={(
        <div className="app-shell">
          <SiteHeader />
          <main className="feed">
            <div className="status-inline">Loading feed...</div>
          </main>
        </div>
      )}
    >
      <FeedPage />
    </Suspense>
  );
}

function FeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [viewedCount, setViewedCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [lastViewed, setLastViewed] = useState<MediaItem | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [nextPromptAt, setNextPromptAt] = useState(randomPromptStep());
  const [ratingValue, setRatingValue] = useState(50);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [reportOpenId, setReportOpenId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(reportReasons[0]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState("");
  const [adPopup, setAdPopup] = useState<number | null>(null);
  const [adMilestones, setAdMilestones] = useState<Set<number>>(
    () => new Set()
  );
  const [lastAdAt, setLastAdAt] = useState<number>(0);
  const [pendingReport, setPendingReport] = useState<string | null>(null);
  const [authFlash, setAuthFlash] = useState<string | null>(null);
  const [appSettings, setAppSettings] =
    useState<AppSettings>(defaultSettings);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState(3);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [feedbackSending, setFeedbackSending] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const seenRef = useRef<Set<string>>(new Set());
  const loadingRef = useRef(false);
  const depthLoggedRef = useRef<Set<number>>(new Set());

  const itemMap = useMemo(() => {
    const map = new Map<string, MediaItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const depth = Math.min(100, Math.max(0, Math.round((currentIndex + 1) * 2) - 1));
  const adAllowed =
    Date.now() - lastAdAt >= appSettings.ad_cooldown_seconds * 1000;

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) return;
    const stored = localStorage.getItem("cursedai_depth_logged");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as number[];
      depthLoggedRef.current = new Set(parsed);
    } catch {
      depthLoggedRef.current = new Set();
    }
  }, []);

  useEffect(() => {
    const storedMilestones = localStorage.getItem("cursedai_ad_milestones");
    const storedLast = localStorage.getItem("cursedai_ad_last");
    if (storedMilestones) {
      try {
        const parsed = JSON.parse(storedMilestones) as number[];
        setAdMilestones(new Set(parsed));
      } catch {
        setAdMilestones(new Set());
      }
    }
    if (storedLast) {
      const parsed = Number(storedLast);
      if (!Number.isNaN(parsed)) {
        setLastAdAt(parsed);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "cursedai_ad_milestones",
      JSON.stringify(Array.from(adMilestones))
    );
  }, [adMilestones]);

  useEffect(() => {
    localStorage.setItem("cursedai_ad_last", String(lastAdAt));
  }, [lastAdAt]);

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) return;
    if (depth <= 0) return;
    if (!localStorage.getItem("cursedai_depth_logged")) {
      depthLoggedRef.current = new Set();
    }
    const milestone = Math.floor(depth / 5) * 5;
    if (milestone <= 0) return;
    if (depthLoggedRef.current.has(milestone)) return;
    depthLoggedRef.current.add(milestone);
    localStorage.setItem(
      "cursedai_depth_logged",
      JSON.stringify(Array.from(depthLoggedRef.current))
    );
    const sendDepth = async () => {
      const sessionValue = localStorage.getItem("cursedai_session_id");
      const { error } = await supabase.from("analytics_events").insert({
        session_id: sessionValue,
        path: "/feed",
        event_type: "depth_reached",
        meta: { depth: milestone },
      });
      if (error) {
        console.error("Depth analytics failed:", error.message);
      }
    };
    sendDepth();
  }, [depth]);

  useEffect(() => {
    const login = searchParams.get("login");
    const logout = searchParams.get("logout");
    if (login !== "success" && logout !== "success") return;
    setAuthFlash(
      login === "success"
        ? "You successfully logged in."
        : "You successfully logged out."
    );
    router.replace("/feed");
    const timer = setTimeout(() => setAuthFlash(null), 10000);
    return () => clearTimeout(timer);
  }, [router, searchParams]);

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setFeedError(
        "Supabase environment variables are missing. Check README setup steps."
      );
      return;
    }

    const restoreSession = async () => {
      const stored = localStorage.getItem("cursedai_session_id");
      if (stored) {
        setSessionId(stored);
        return;
      }

      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_agent: navigator.userAgent })
        .select("id")
        .single();

      if (error) {
        setFeedError(`Session failed: ${error.message}`);
        return;
      }

      if (data?.id) {
        localStorage.setItem("cursedai_session_id", data.id);
        setSessionId(data.id);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (!supabaseEnv.url || !supabaseEnv.key) return;
    const loadSettings = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value");
      if (!data) return;
      const next = { ...defaultSettings };
      data.forEach((item) => {
        if (item.key in next) {
          (next as Record<string, unknown>)[item.key] = item.value;
        }
      });
      setAppSettings(next);
    };
    loadSettings();
  }, []);

  const loadMore = async () => {
    if (loadingRef.current || !hasMore) return;
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setFeedError(
        "Supabase environment variables are missing. Check README setup steps."
      );
      return;
    }
    setFeedError(null);
    setIsLoading(true);
    loadingRef.current = true;

    const from = page * pageSize;
    const to = from + pageSize - 1;
    const minScore = 10 + 0.75 * depth;
    const minConf = 0.2 + 0.006 * depth;
    const eligibility = `rating_count.eq.0,and(score.gte.${minScore},confidence.gte.${minConf})`;

    const { data, error } = await supabase
      .from("media")
      .select("id, kind, asset_url, caption, origin, rating_count, score, confidence")
      .eq("is_hidden", false)
      .neq("status", "removed")
      .neq("status", "graveyard")
      .or(eligibility)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setFeedError(`Feed failed: ${error.message}`);
    } else if (data) {
      setItems((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const next = data.filter((item) => !existing.has(item.id));
        return [...prev, ...next];
      });
      setPage((prev) => prev + 1);
      if (data.length < pageSize) {
        setHasMore(false);
      }
    }

    setIsLoading(false);
    loadingRef.current = false;
  };

  useEffect(() => {
    loadMore();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, page, depth]);

useEffect(() => {
    const nodes = Object.values(itemRefs.current).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let topEntry: IntersectionObserverEntry | null = null;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!topEntry || entry.intersectionRatio > topEntry.intersectionRatio) {
            topEntry = entry;
          }
        });

        if (topEntry) {
          const id = topEntry.target.getAttribute("data-id");
          const indexAttr = topEntry.target.getAttribute("data-index");
          const index = indexAttr ? Number(indexAttr) : -1;
          if (id) {
            const item = itemMap.get(id);
            if (item) setLastViewed(item);
          }
          if (!Number.isNaN(index) && index >= 0) {
            setCurrentIndex(index);
          }
        }

        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-id");
          if (!id) return;
          const item = itemMap.get(id);
          if (!item) return;

          const video = entry.target.querySelector("video");
          if (video) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
              video.play().catch(() => undefined);
            } else {
              video.pause();
            }
          }

          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
          if (!seenRef.current.has(id)) {
            seenRef.current.add(id);
            setViewedCount((prev) => {
              const next = prev + 1;
              if (appSettings.ratings_enabled && !showPrompt && next >= nextPromptAt) {
                setShowPrompt(true);
              }
              return next;
            });
          }
        });
      },
      { threshold: [0.4, 0.6] }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [itemMap, nextPromptAt, showPrompt]);

  useEffect(() => {
    if (showPrompt) {
      setRatingValue(50);
      setRatingError(null);
    }
  }, [showPrompt]);

  useEffect(() => {
    if (!appSettings.ads_enabled) return;
    const thresholds = appSettings.ad_milestones;
    const next = thresholds.find(
      (value) => depth >= value && !adMilestones.has(value)
    );
    if (next === undefined) return;
    if (!adAllowed) return;
    if (adMilestones.size >= 3) return;
    setAdPopup(next);
    setAdMilestones((prev) => new Set(prev).add(next));
    setLastAdAt(Date.now());
  }, [depth, adAllowed, adMilestones, appSettings]);

  const handleSubmit = async () => {
    if (!sessionId || !lastViewed) {
      setRatingError("Rating failed: session or media missing.");
      return;
    }
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setRatingError("Rating failed: missing Supabase environment.");
      return;
    }

    setRatingError(null);
    const { data, error } = await supabase.functions.invoke("rateMedia", {
      body: {
        session_id: sessionId,
        media_id: lastViewed.id,
        rating: ratingValue,
      },
    });

    if (error) {
      const response =
        "response" in error && error.response ? error.response : null;
      if (response && response.status === 409) {
        setRatingError("You already rated this item.");
      } else if ("message" in error && error.message) {
        setRatingError(`Rating failed: ${error.message}`);
      } else {
        setRatingError("Rating failed.");
      }
      return;
    }

    if (data?.score !== undefined) {
      const rounded = Math.round(data.score);
      setStatusMessage(`Global rating: ${rounded}% cursed.`);
    } else {
      setStatusMessage("Rating logged.");
    }
    setTimeout(() => setStatusMessage(null), 2000);
    setShowPrompt(false);
    setNextPromptAt(viewedCount + randomPromptStep());
    setRatingValue(50);
  };

  const handleSkip = () => {
    setShowPrompt(false);
    setNextPromptAt(viewedCount + randomPromptStep());
  };

  const handleReportSubmit = async (mediaId: string) => {
    if (!sessionId) {
      setReportError("Report failed: session missing.");
      return;
    }
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setReportError("Report failed: missing Supabase environment.");
      return;
    }

    const reportItem = itemMap.get(mediaId);
    setReportError(null);
    setPendingReport(mediaId);
    const { error } = await supabase.from("reports").insert({
      session_id: sessionId,
      media_id: mediaId,
      reason: reportReason,
      details: reportNote.trim() ? reportNote.trim() : null,
      media_asset_url: reportItem?.asset_url ?? null,
      media_kind: reportItem?.kind ?? null,
      media_caption: reportItem?.caption ?? null,
    });

    if (error) {
      setReportError(`Report failed: ${error.message}`);
      setPendingReport(null);
      return;
    }

    setReportOpenId(null);
    setReportNote("");
    setPendingReport(null);
    setStatusMessage("Report logged.");
    setTimeout(() => setStatusMessage(null), 2000);
  };

  const handleFeedbackSubmit = async () => {
    if (!sessionId) {
      setFeedbackStatus("Feedback failed: session missing.");
      return;
    }
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setFeedbackStatus("Feedback failed: missing Supabase environment.");
      return;
    }
    setFeedbackSending(true);
    setFeedbackStatus(null);
    const { error } = await supabase.from("feedback").insert({
      session_id: sessionId,
      score: feedbackScore,
      notes: feedbackText.trim() ? feedbackText.trim() : null,
    });
    if (error) {
      setFeedbackStatus(`Feedback failed: ${error.message}`);
      setFeedbackSending(false);
      return;
    }
    setFeedbackStatus("Feedback logged.");
    setFeedbackSending(false);
    setFeedbackText("");
    setFeedbackScore(3);
    setTimeout(() => {
      setFeedbackOpen(false);
      setFeedbackStatus(null);
    }, 1200);
  };

  return (
    <div className="app-shell">
      <SiteHeader />
      <section className="meter" aria-label="Cursedness meter">
        <div className="meter-inner">
          <div className="meter-label">Depth {depth}%</div>
          <img
            className="meter-mark"
            src="/depth-calibration-mark.svg"
            alt=""
            aria-hidden="true"
          />
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${depth}%` }} />
          </div>
        </div>
      </section>
      {feedError && <div className="status-bar error">{feedError}</div>}
      <main className="feed">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="media-item"
            style={{ animationDelay: `${index * 40}ms` }}
            ref={(node) => {
              itemRefs.current[item.id] = node;
            }}
            data-id={item.id}
            data-index={index}
          >
            <div className="media-frame">
              <div className="media-frame-top" aria-hidden="true">
                <span className="media-frame-tag">Item {index + 1}</span>
                <span className="media-frame-tag">
                  {item.kind === "video" ? "Motion" : "Still"}
                </span>
              </div>
              {index === 0 && (
                <div className="media-edge-ticker" aria-hidden="true">
                  cursedcursedcursedcursedcursedcursedcursedcursedcursedcursedcursedcursedcursedcursedcursedcursed
                </div>
              )}
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
              <div className="media-tools">
                <button
                  className="button button-ghost"
                  onClick={() => {
                    setLastViewed(item);
                    setShowPrompt(true);
                  }}
                >
                  Rate
                </button>
                {appSettings.reports_enabled && (
                  <button
                    className="button button-ghost"
                    onClick={() =>
                      setReportOpenId((prev) =>
                        prev === item.id ? null : item.id
                      )
                    }
                  >
                    Report
                  </button>
                )}
              </div>
              {appSettings.reports_enabled && reportOpenId === item.id && (
                <div className="report-panel">
                  <label className="report-label" htmlFor={`report-${item.id}`}>
                    Reason
                  </label>
                  <select
                    id={`report-${item.id}`}
                    className="report-select"
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                  >
                    {reportReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <label className="report-label" htmlFor={`report-note-${item.id}`}>
                    Notes (optional)
                  </label>
                  <input
                    id={`report-note-${item.id}`}
                    className="input"
                    type="text"
                    value={reportNote}
                    onChange={(event) => setReportNote(event.target.value)}
                    placeholder="Short context"
                  />
                  <div className="rating-actions">
                    <button
                      className="button"
                      onClick={() => handleReportSubmit(item.id)}
                      disabled={pendingReport === item.id}
                    >
                      {pendingReport === item.id ? "Sending..." : "Send"}
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={() => setReportOpenId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  {reportError && (
                    <div className="status-inline">{reportError}</div>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
        {isLoading && <div className="status-inline">Loading more...</div>}
        {!hasMore && (
          <div className="status-inline">End of the current stack.</div>
        )}
        <div ref={sentinelRef} />
      </main>
      {showPrompt && lastViewed && (
        <section className="rating-dock" aria-live="polite">
          <div className="rating-thumb">
            {lastViewed.kind === "image" ? (
              <img
                src={lastViewed.asset_url}
                alt="Last viewed media thumbnail"
              />
            ) : (
              <video
                src={lastViewed.asset_url}
                muted
                autoPlay
                loop
                playsInline
              />
            )}
          </div>
          <div className="rating-body">
            <div className="rating-title">How cursed was this?</div>
            <input
              className="slider"
              type="range"
              min={1}
              max={100}
              value={ratingValue}
              onChange={(event) => setRatingValue(Number(event.target.value))}
            />
            <div className="rating-actions">
              <button className="button" onClick={handleSubmit}>
                Submit anyway {ratingValue}
              </button>
              <button className="button button-ghost" onClick={handleSkip}>
                Pretend it wasn't seen
              </button>
            </div>
            {ratingError && <div className="status-inline">{ratingError}</div>}
          </div>
        </section>
      )}
      {statusMessage && <div className="toast">{statusMessage}</div>}
      {authFlash && (
        <div className="toast toast-auth" role="status">
          <span>{authFlash}</span>
          <button
            className="toast-close"
            type="button"
            aria-label="Dismiss login message"
            onClick={() => setAuthFlash(null)}
          >
            X
          </button>
        </div>
      )}
      {appSettings.ads_enabled && (
        <footer className="ad-slot" aria-label="Advertisement">
          <span className="ad-tag">Ad</span>
          <span className="ad-copy">
            The feed is sponsored by your remaining attention span.
          </span>
          <button className="button button-ghost">Fine print</button>
        </footer>
      )}
      <button
        className="button feedback-fab"
        type="button"
        onClick={() => setFeedbackOpen(true)}
      >
        Feedback
      </button>
      <img
        className="feedback-mark"
        src="/depth-calibration-mark.svg"
        alt=""
        aria-hidden="true"
      />
      {feedbackOpen && (
        <div className="feedback-modal" role="dialog" aria-modal="true">
          <div className="feedback-card">
            <div className="panel-title">Feedback</div>
            <p className="page-subtitle">
              Short, quiet notes. The feed should feel alive.
            </p>
            <label className="field">
              Did the feed feel alive?
              <select
                className="input"
                value={feedbackScore}
                onChange={(event) =>
                  setFeedbackScore(Number(event.target.value))
                }
              >
                <option value={1}>1 - dead</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5 - alive</option>
              </select>
            </label>
            <label className="field">
              Notes (optional)
              <textarea
                className="input feedback-notes"
                rows={4}
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
                placeholder="What felt wrong, slow, or unclear?"
              />
            </label>
            <div className="rating-actions">
              <button
                className="button"
                type="button"
                onClick={handleFeedbackSubmit}
                disabled={feedbackSending}
              >
                {feedbackSending ? "Sending..." : "Send"}
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setFeedbackOpen(false)}
              >
                Close
              </button>
            </div>
            {feedbackStatus && (
              <div className="status-inline">{feedbackStatus}</div>
            )}
          </div>
        </div>
      )}
      {appSettings.ads_enabled && adPopup !== null && (
        <div className="ad-popup" role="dialog" aria-modal="true">
          <div className="ad-popup-card">
            <div className="ad-popup-title">Advertisement</div>
            <div className="ad-popup-copy">
              Depth {adPopup}%: a brief interruption. The feed does not care if
              you are ready.
            </div>
            <div className="rating-actions">
              <button className="button" onClick={() => setAdPopup(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
