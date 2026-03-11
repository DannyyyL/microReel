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
  private unavailableVideoIds = new Set<string>();

  constructor(
    videos: VideoCard[] = defaultVideos,
    private readonly random: () => number = Math.random
  ) {
    this.videos = videos;
  }

  /** Swap in a new video list (e.g. after a remote fetch). */
  setVideos(videos: VideoCard[]): void {
    this.videos = videos;
  }

  hasAvailableVideos(): boolean {
    return this.videos.some((video) => !this.unavailableVideoIds.has(video.youtubeId));
  }

  nextVideo(): VideoCard | null {
    return this.pickVideoOrNull();
  }

  markVideoUnavailable(video: VideoCard | string): void {
    const youtubeId = typeof video === "string" ? video : video.youtubeId;
    this.unavailableVideoIds.add(youtubeId);
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
    const index = Math.floor(this.random() * pool.length);
    const selected = pool[index];

    this.trackRecent(selected.id);

    return {
      ...selected,
      ttlMs: Math.max(selected.ttlMs, input.elapsedMs > 20_000 ? 8_000 : selected.ttlMs)
    };
  }

  private pickVideo(): VideoCard {
    const selected = this.pickVideoOrNull();

    if (!selected) {
      throw new Error("microreel: no videos available");
    }

    return selected;
  }

  private pickVideoOrNull(): VideoCard | null {
    const availableVideos = this.videos.filter((video) => !this.unavailableVideoIds.has(video.youtubeId));
    if (availableVideos.length === 0) {
      return null;
    }

    const candidates = availableVideos.filter((video) => !this.recentIds.has(video.id));
    const pool = candidates.length > 0 ? candidates : availableVideos;
    const index = Math.floor(this.random() * pool.length);
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
