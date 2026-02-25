import { cards } from "./cards";
import { videos } from "./videos";
import { ContentMode, EngineInput, MicroCard, VideoCard } from "./types";

export type EngineResult =
  | { kind: "card"; card: MicroCard }
  | { kind: "video"; video: VideoCard };

export class MicroContentEngine {
  private recentIds: string[] = [];
  private readonly maxRecent = 2;

  next(input: EngineInput, mode: ContentMode): EngineResult {
    if (mode === "entertainment") {
      return { kind: "video", video: this.pickVideo() };
    }
    return { kind: "card", card: this.pickCard(input) };
  }

  private pickCard(input: EngineInput): MicroCard {
    const candidates = cards.filter((card) => !this.recentIds.includes(card.id));
    const pool = candidates.length > 0 ? candidates : cards;
    const index = Math.floor(Math.random() * pool.length);
    const selected = pool[index];

    this.recentIds = [selected.id, ...this.recentIds].slice(0, this.maxRecent);

    return {
      ...selected,
      ttlMs: Math.max(selected.ttlMs, input.elapsedMs > 20_000 ? 8_000 : selected.ttlMs)
    };
  }

  private pickVideo(): VideoCard {
    const candidates = videos.filter((v) => !this.recentIds.includes(v.id));
    const pool = candidates.length > 0 ? candidates : videos;
    const index = Math.floor(Math.random() * pool.length);
    const selected = pool[index];

    this.recentIds = [selected.id, ...this.recentIds].slice(0, this.maxRecent);

    return selected;
  }
}
