export type MediaKind = "image" | "video";

export type MediaItem = {
  id: string;
  kind: MediaKind;
  src: string;
  thumb: string;
  caption: string;
  origin: string;
};

const baseMedia: Omit<MediaItem, "id">[] = [
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    thumb:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=70",
    caption: "A hallway that appears to be expecting something else.",
    origin: "model: lathe-01 / prompt: transit chapel",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1400&q=80",
    thumb:
      "https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=400&q=70",
    caption: "A face-shaped reflection that does not match the room.",
    origin: "model: filigree-2 / prompt: interior echo",
  },
  {
    kind: "video",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumb: "https://images.unsplash.com/photo-1471879832106-c7ab9e0cee23?auto=format&fit=crop&w=400&q=70",
    caption: "A loop that keeps insisting it is natural.",
    origin: "model: vector-7 / prompt: bloom loop",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80",
    thumb:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=70",
    caption: "Sky that cannot decide if it wants to be above or behind.",
    origin: "model: vault-9 / prompt: inverted atmosphere",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80",
    thumb:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=70",
    caption: "The map insists the water is closer than it should be.",
    origin: "model: atlas-3 / prompt: misplaced coastline",
  },
  {
    kind: "video",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
    thumb: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=70",
    caption: "Motion that knows where it will end but keeps moving.",
    origin: "model: filament-2 / prompt: soft insistence",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=80",
    thumb:
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=400&q=70",
    caption: "The landscape is stable, the shadows are not.",
    origin: "model: hollow-5 / prompt: double dusk",
  },
  {
    kind: "image",
    src: "https://images.unsplash.com/photo-1500534314209-a26db0f5c68d?auto=format&fit=crop&w=1400&q=80",
    thumb:
      "https://images.unsplash.com/photo-1500534314209-a26db0f5c68d?auto=format&fit=crop&w=400&q=70",
    caption: "Fog that feels curated, not weathered.",
    origin: "model: hush-4 / prompt: curated mist",
  },
];

export const createMockBatch = (startIndex: number, count: number) => {
  return Array.from({ length: count }).map((_, index) => {
    const base = baseMedia[(startIndex + index) % baseMedia.length];
    return {
      ...base,
      id: `media-${startIndex + index}-${base.kind}`,
    };
  });
};
