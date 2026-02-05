"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { supabase, supabaseEnv } from "@/lib/supabaseClient";

type MediaItem = {
  id: string;
  kind: "image" | "video";
  asset_url: string;
  caption: string | null;
  origin: string | null;
  score: number;
};

const pageSize = 8;

export default function GraveyardPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const loadingRef = useRef(false);

  const itemMap = useMemo(() => {
    const map = new Map<string, MediaItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const loadMore = async () => {
    if (!supabaseEnv.url || !supabaseEnv.key) {
      setFeedError(
        "Supabase environment variables are missing. Check README setup steps."
      );
      return;
    }
    if (loadingRef.current || isLoading || !hasMore) return;
    setFeedError(null);
    setIsLoading(true);
    loadingRef.current = true;

    const from = page * pageSize;
    const to = from + pageSize - 1;
    try {
      const { data, error } = await supabase
        .from("media")
        .select("id, kind, asset_url, caption, origin, score")
        .eq("status", "graveyard")
        .eq("is_hidden", false)
        .order("score", { ascending: true })
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
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
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
  }, [hasMore, page]);

  useEffect(() => {
    const nodes = Object.values(itemRefs.current).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target.querySelector("video");
          if (!video) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            video.play().catch(() => undefined);
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0.4] }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [itemMap]);

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="feed">
        <div className="page-shell">
          <div className="page-title melt-title" aria-label="Graveyard">
            {"Graveyard".split("").map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="melt-letter"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                {char}
              </span>
            ))}
          </div>
          <div className="graveyard-intro">
            <p>
              Items rated too uncursed are archived here, listed from least
              cursed upward.
            </p>
            <p className="graveyard-note">
              The feed keeps descending. The graveyard keeps the quiet exits.
            </p>
          </div>
        </div>
        {feedError && <div className="status-bar error">{feedError}</div>}
        {items.map((item, index) => (
          <article
            key={item.id}
            className="media-item"
            style={{ animationDelay: `${index * 40}ms` }}
            ref={(node) => {
              itemRefs.current[item.id] = node;
            }}
            data-id={item.id}
          >
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
              <div>Score: {Math.round(item.score)}% cursed</div>
            </div>
          </article>
        ))}
        {isLoading && <div className="status-inline">Loading more...</div>}
        {!hasMore && (
          <div className="status-inline">Nothing else surfaces here.</div>
        )}
        <div ref={sentinelRef} />
      </main>
      <footer className="ad-slot" aria-label="Advertisement">
        <span className="ad-tag">Ad</span>
        <span className="ad-copy">
          Graveyard sponsorship available. The dead do not negotiate.
        </span>
        <button className="button button-ghost">Fine print</button>
      </footer>
    </div>
  );
}
