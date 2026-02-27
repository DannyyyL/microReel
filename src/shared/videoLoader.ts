import { VideoCard } from "./types";
import { videos as fallbackVideos } from "./videos";

/**
 * URL of the remote video list.
 * Edit `content/videos.json` on GitHub and the extension picks it up within
 * CACHE_TTL_MS (default 24 h) without requiring a new extension release.
 */
const REMOTE_URL =
  "https://raw.githubusercontent.com/DannyyyL/microReel/main/content/videos.json";

const CACHE_KEY = "microreel.videos.cache";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface VideoCache {
  fetchedAt: number;
  videos: VideoCard[];
}

/**
 * Loads the video list using a three-level strategy:
 *   1. Return from chrome.storage.local cache if fresher than CACHE_TTL_MS
 *   2. Fetch from GitHub, write to cache, return
 *   3. Fall back to the hardcoded list bundled with the extension
 */
export async function loadVideos(): Promise<VideoCard[]> {
  // --- 1. Cache hit ---
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cached = result[CACHE_KEY] as VideoCache | undefined;
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.videos?.length) {
      console.debug("microreel: videos loaded from cache", cached.videos.length);
      return cached.videos;
    }
  } catch {
    // storage unavailable – proceed to fetch
  }

  // --- 2. Remote fetch ---
  try {
    const res = await fetch(REMOTE_URL, { cache: "no-store" });
    if (res.ok) {
      const videos = (await res.json()) as VideoCard[];
      if (Array.isArray(videos) && videos.length) {
        const entry: VideoCache = { fetchedAt: Date.now(), videos };
        await chrome.storage.local.set({ [CACHE_KEY]: entry });
        console.debug("microreel: videos fetched from remote", videos.length);
        return videos;
      }
    }
  } catch {
    // network error, offline, etc.
  }

  // --- 3. Hardcoded fallback ---
  console.debug("microreel: using fallback video list");
  return fallbackVideos;
}

/**
 * Force the next loadVideos() call to re-fetch even if cache is fresh.
 * Call this from the options page if you add an "Update now" button.
 */
export async function invalidateVideoCache(): Promise<void> {
  try {
    await chrome.storage.local.remove(CACHE_KEY);
  } catch {
    // ignore
  }
}
