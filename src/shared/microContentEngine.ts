import { cards } from "./cards";
import { EngineInput, MicroCard } from "./types";

export class MicroContentEngine {
  private recentIds: string[] = [];
  private readonly maxRecent = 2;

  next(input: EngineInput): MicroCard {
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
}
