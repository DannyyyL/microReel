import { cards } from "./cards";
import { videos as defaultVideos } from "./videos";
import { ContentMode, EngineInput, MicroCard, VideoCard } from "./types";

export type EngineResult =
  | { kind: "card"; card: MicroCard }
  | { kind: "video"; video: VideoCard };

export class MicroContentEngine {
  private recentIds = new Set<string>();
  private readonly maxRecent = 2;
  private videos: VideoCard[];

  constructor(videos: VideoCard[] = defaultVideos) {
    this.videos = videos;
  }

  /** Swap in a new video list (e.g. after a remote fetch). */
  setVideos(videos: VideoCard[]): void {
    if (videos.length) {
      this.videos = videos;
    }
  }

  next(input: EngineInput, mode: ContentMode): EngineResult {
    if (mode === "entertainment") {
      return { kind: "video", video: this.pickVideo() };
    }
    return { kind: "card", card: this.pickCard(input) };
  }

  private pickCard(input: EngineInput): MicroCard {
    const candidates = cards.filter((card) => !this.recentIds.has(card.id));
    const pool = candidates.length > 0 ? candidates : cards;
    const index = Math.floor(Math.random() * pool.length);
    const selected = pool[index];

    this.trackRecent(selected.id);

    return {
      ...selected,
      ttlMs: Math.max(selected.ttlMs, input.elapsedMs > 20_000 ? 8_000 : selected.ttlMs)
    };
  }

  private pickVideo(): VideoCard {
    const candidates = this.videos.filter((v) => !this.recentIds.has(v.id));
    const pool = candidates.length > 0 ? candidates : this.videos;
    const index = Math.floor(Math.random() * pool.length);
    const selected = pool[index];

    this.trackRecent(selected.id);

    return selected;
  }

  private trackRecent(id: string): void {
    this.recentIds.add(id);
    if (this.recentIds.size > this.maxRecent) {
      // Remove the oldest entry (first inserted)
      const first = this.recentIds.values().next().value!;
      this.recentIds.delete(first);
    }
  }
}
