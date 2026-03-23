import fs from "fs/promises";
import path from "path";

const API_KEY = process.env.YOUTUBE_API_KEY;
const OUTPUT_FILE = path.join(process.cwd(), "content", "videos.json");

// General entertainment search queries
const SEARCH_QUERIES = [
  "#shorts family guy", 
  "#shorts timelapse", 
  "#shorts satisfying", 
  "#shorts which room",
  "#shorts funny clips"
];
const MAX_RESULTS_PER_QUERY = 5;

async function fetchShorts() {
  if (!API_KEY) {
    console.error("Error: YOUTUBE_API_KEY environment variable is missing.");
    process.exit(1);
  }

  const allVideos = [];
  const seenIds = new Set();

  console.log("Fetching new YouTube Shorts...");

  for (const query of SEARCH_QUERIES) {
    try {
      // Use YouTube Data API v3 Search endpoint
      // videoDuration=short filters for videos < 4 minutes
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("maxResults", MAX_RESULTS_PER_QUERY.toString());
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("videoDuration", "short");
      url.searchParams.set("key", API_KEY);

      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(`Failed to fetch for query "${query}": ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.error(text);
        continue;
      }

      const data = await res.json();
      
      for (const item of data.items || []) {
        const videoId = item.id?.videoId;
        if (!videoId || seenIds.has(videoId)) continue;

        seenIds.add(videoId);
        allVideos.push({
          id: `short-${videoId}`,
          title: item.snippet?.title || "YouTube Short",
          youtubeId: videoId,
          ttlMs: 30000 // default 30 seconds
        });
      }
    } catch (err) {
      console.error(`Error fetching query "${query}":`, err);
    }
  }

  if (allVideos.length === 0) {
    console.error("No videos found. Keeping existing file.");
    process.exit(0);
  }

  // Preserve some existing videos so we don't completely overwrite everything and cause empty pools
  let existingVideos = [];
  try {
    const existingData = await fs.readFile(OUTPUT_FILE, "utf-8");
    existingVideos = JSON.parse(existingData);
  } catch {
    // If it doesn't exist or is invalid, start fresh
  }

  // Merge them (preferring new ones, but keeping max ~50 to prevent infinite growth)
  const merged = [...allVideos];
  for (const ev of existingVideos) {
    if (!seenIds.has(ev.youtubeId) && merged.length < 50) {
      merged.push(ev);
      seenIds.add(ev.youtubeId);
    }
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Successfully wrote ${merged.length} videos to ${OUTPUT_FILE}`);
}

fetchShorts().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
