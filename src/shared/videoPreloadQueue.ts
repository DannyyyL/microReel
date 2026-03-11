import { VideoCard } from "./types";
import { validateYoutubeVideo, rememberUnavailableVideo } from "./videoLoader";
import { MicroContentEngine } from "./microContentEngine";

/**
 * Pre-validates YouTube videos in the background so that by the time
 * generation starts, a validated video is already waiting.
 *
 * The queue maintains a list of validated-but-not-yet-shown video cards.
 * It runs validation asynchronously at idle time (or immediately after
 * construction) so the oEmbed network call never blocks the critical path.
 */
export class VideoPreloadQueue {
  private readonly queue: VideoCard[] = [];
  private validating = false;
  private disposed = false;

  /** How many validated videos to keep ready ahead of time. */
  private readonly targetSize: number;

  constructor(
    private readonly engine: MicroContentEngine,
    options?: { targetSize?: number }
  ) {
    this.targetSize = options?.targetSize ?? 3;
  }

  /**
   * Kick off background validation to fill the queue up to `targetSize`.
   * Safe to call multiple times — concurrent runs are serialized.
   */
  fill(): void {
    if (this.validating || this.disposed) return;
    void this.fillLoop();
  }

  /**
   * Pull the next validated video from the queue.
   * Returns `null` if the queue is empty (caller should fall back to
   * on-demand validation or show a card instead).
   */
  take(): VideoCard | null {
    const video = this.queue.shift() ?? null;
    // Refill in the background whenever we consume an entry.
    this.fill();
    return video;
  }

  /** Peek at the next video without removing it. */
  peek(): VideoCard | null {
    return this.queue[0] ?? null;
  }

  /** Number of validated videos currently ready. */
  get size(): number {
    return this.queue.length;
  }

  /** Mark a video as unavailable (failed at runtime) and refill. */
  async markUnavailable(video: VideoCard): Promise<void> {
    this.engine.markVideoUnavailable(video);
    await rememberUnavailableVideo(video.youtubeId);
    // Remove it from the queue if it was queued.
    const idx = this.queue.findIndex((v) => v.youtubeId === video.youtubeId);
    if (idx !== -1) this.queue.splice(idx, 1);
    this.fill();
  }

  /** Stop all background work. */
  dispose(): void {
    this.disposed = true;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async fillLoop(): Promise<void> {
    if (this.validating || this.disposed) return;
    this.validating = true;

    try {
      while (this.queue.length < this.targetSize && !this.disposed) {
        if (!this.engine.hasAvailableVideos()) break;

        const candidate = this.engine.nextVideo();
        if (!candidate) break;

        // Skip if this video is already in the queue.
        if (this.queue.some((v) => v.youtubeId === candidate.youtubeId)) continue;

        const valid = await validateYoutubeVideo(candidate);
        if (this.disposed) break;

        if (!valid) {
          this.engine.markVideoUnavailable(candidate);
          await rememberUnavailableVideo(candidate.youtubeId);
          continue;
        }

        this.queue.push(candidate);
      }
    } finally {
      this.validating = false;
    }
  }
}
