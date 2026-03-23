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
const UNAVAILABLE_VIDEO_KEY = "microreel.videos.unavailable";
const UNAVAILABLE_VIDEO_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const YOUTUBE_OEMBED_URL = "https://www.youtube.com/oembed";
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

interface VideoCache {
  fetchedAt: number;
  videos: VideoCard[];
}

type UnavailableVideoCache = Record<string, number>;

function normalizeVideoList(value: unknown): VideoCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenYoutubeIds = new Set<string>();
  const normalized: VideoCard[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Partial<VideoCard>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const youtubeId = typeof candidate.youtubeId === "string" ? candidate.youtubeId.trim() : "";
    const ttlMs =
      typeof candidate.ttlMs === "number" && Number.isFinite(candidate.ttlMs)
        ? Math.max(5_000, Math.round(candidate.ttlMs))
        : 30_000;

    if (!id || !title || !youtubeId || !YOUTUBE_ID_RE.test(youtubeId) || seenYoutubeIds.has(youtubeId)) {
      continue;
    }

    seenYoutubeIds.add(youtubeId);
    normalized.push({ id, title, youtubeId, ttlMs });
  }

  return normalized;
}

function normalizeUnavailableVideoCache(value: unknown): UnavailableVideoCache {
  if (!value || typeof value !== "object") {
    return {};
  }

  const now = Date.now();
  const normalized: UnavailableVideoCache = {};

  for (const [youtubeId, timestamp] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof youtubeId === "string" &&
      youtubeId &&
      typeof timestamp === "number" &&
      Number.isFinite(timestamp) &&
      now - timestamp < UNAVAILABLE_VIDEO_TTL_MS
    ) {
      normalized[youtubeId] = timestamp;
    }
  }

  return normalized;
}

function filterUnavailableVideos(videos: VideoCard[], unavailableVideoIds: Set<string>): VideoCard[] {
  if (unavailableVideoIds.size === 0) {
    return videos;
  }

  return videos.filter((video) => !unavailableVideoIds.has(video.youtubeId));
}

async function getUnavailableVideoIds(): Promise<Set<string>> {
  try {
    const result = await chrome.storage.local.get(UNAVAILABLE_VIDEO_KEY);
    const unavailableCache = normalizeUnavailableVideoCache(result[UNAVAILABLE_VIDEO_KEY]);

    await chrome.storage.local.set({ [UNAVAILABLE_VIDEO_KEY]: unavailableCache });

    return new Set(Object.keys(unavailableCache));
  } catch {
    return new Set();
  }
}

export async function validateYoutubeVideo(video: VideoCard): Promise<boolean> {
  try {
    const url = new URL(YOUTUBE_OEMBED_URL);
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${video.youtubeId}`);
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return false;
    }

    const payload = await response.json() as Record<string, unknown>;

    return typeof payload.title === "string" && payload.title.length > 0;
  } catch {
    return false;
  }
}

/**
 * Loads the video list using a three-level strategy:
 *   1. Return from chrome.storage.local cache if fresher than CACHE_TTL_MS
 *   2. Fetch from GitHub, write to cache, return
 *   3. Fall back to the hardcoded list bundled with the extension
 */
export async function loadVideos(): Promise<VideoCard[]> {
  const unavailableVideoIds = await getUnavailableVideoIds();

  // --- 1. Cache hit ---
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cached = result[CACHE_KEY] as VideoCache | undefined;
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      const cachedVideos = filterUnavailableVideos(
        normalizeVideoList(cached.videos),
        unavailableVideoIds
      );

      if (cachedVideos.length) {
        console.debug("microreel: videos loaded from cache", cachedVideos.length);
        return cachedVideos;
      }
    }
  } catch {
    // storage unavailable – proceed to fetch
  }

  // --- 2. Remote fetch ---
  try {
    const res = await fetch(REMOTE_URL, { cache: "no-store" });
    if (res.ok) {
      const videos = normalizeVideoList(await res.json());
      if (videos.length) {
        const entry: VideoCache = { fetchedAt: Date.now(), videos };
        await chrome.storage.local.set({ [CACHE_KEY]: entry });

        const availableVideos = filterUnavailableVideos(videos, unavailableVideoIds);
        if (availableVideos.length) {
          console.debug("microreel: videos fetched from remote", availableVideos.length);
          return availableVideos;
        }
      }
    }
  } catch {
    // network error, offline, etc.
  }

  // --- 3. Hardcoded fallback ---
  const availableFallbackVideos = filterUnavailableVideos(
    normalizeVideoList(fallbackVideos),
    unavailableVideoIds
  );

  console.debug("microreel: using fallback video list");
  return availableFallbackVideos;
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

export async function rememberUnavailableVideo(youtubeId: string): Promise<void> {
  if (!youtubeId) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(UNAVAILABLE_VIDEO_KEY);
    const unavailableCache = normalizeUnavailableVideoCache(result[UNAVAILABLE_VIDEO_KEY]);

    unavailableCache[youtubeId] = Date.now();

    await chrome.storage.local.set({ [UNAVAILABLE_VIDEO_KEY]: unavailableCache });
  } catch {
    // ignore
  }
}
