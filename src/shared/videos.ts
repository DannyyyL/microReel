import { VideoCard } from "./types";

/**
 * Curated list of YouTube Shorts.
 * The `id` field is an internal key for deduplication.
 * The `youtubeId` field is the ID from the YouTube Shorts URL.
 */
export const videos: VideoCard[] = [
  {
    id: "short-1",
    title: "Short 1",
    youtubeId: "u0LIQvzUEvo",
    ttlMs: 30000
  },
  {
    id: "short-2",
    title: "Short 2",
    youtubeId: "me084ZSdZXo",
    ttlMs: 30000
  },
  {
    id: "short-3",
    title: "Short 3",
    youtubeId: "bkVatWPB5oA",
    ttlMs: 30000
  },
  {
    id: "short-4",
    title: "Short 4",
    youtubeId: "zF2Mlyy_-V0",
    ttlMs: 30000
  }
];
