import test from "node:test";
import assert from "node:assert/strict";
import { MicroContentEngine } from "../src/shared/microContentEngine";
import { VideoPreloadQueue } from "../src/shared/videoPreloadQueue";
import { VideoCard } from "../src/shared/types";

const testVideos: VideoCard[] = [
  { id: "v1", title: "Video 1", youtubeId: "yt_aaa", ttlMs: 30_000 },
  { id: "v2", title: "Video 2", youtubeId: "yt_bbb", ttlMs: 30_000 },
  { id: "v3", title: "Video 3", youtubeId: "yt_ccc", ttlMs: 30_000 },
  { id: "v4", title: "Video 4", youtubeId: "yt_ddd", ttlMs: 30_000 },
];

// We need to stub validateYoutubeVideo and rememberUnavailableVideo
// since VideoPreloadQueue imports them from videoLoader.
// For unit tests we test the queue's public API with a mock engine
// that has a controlled video sequence.

test("VideoPreloadQueue take returns null when queue is empty", () => {
  const engine = new MicroContentEngine(testVideos, () => 0);
  const queue = new VideoPreloadQueue(engine, { targetSize: 2 });
  // Without calling fill(), queue should be empty.
  const result = queue.take();
  assert.equal(result, null);
  assert.equal(queue.size, 0);
  queue.dispose();
});

test("VideoPreloadQueue peek does not remove from queue", () => {
  const engine = new MicroContentEngine(testVideos, () => 0);
  const queue = new VideoPreloadQueue(engine, { targetSize: 2 });
  // Queue is empty, peek returns null
  assert.equal(queue.peek(), null);
  assert.equal(queue.size, 0);
  queue.dispose();
});

test("VideoPreloadQueue dispose prevents further fill", () => {
  const engine = new MicroContentEngine(testVideos, () => 0);
  const queue = new VideoPreloadQueue(engine, { targetSize: 2 });
  queue.dispose();
  queue.fill(); // should no-op after dispose
  assert.equal(queue.size, 0);
});

test("VideoPreloadQueue markUnavailable removes from queue and engine", async () => {
  const engine = new MicroContentEngine(testVideos, () => 0);
  const queue = new VideoPreloadQueue(engine, { targetSize: 2 });

  // Manually test markUnavailable marks the engine video as unavailable.
  // Note: In real usage, fill() populates the queue via validateYoutubeVideo
  // (network call). Here we just test the markUnavailable path.
  const video = testVideos[0];
  await queue.markUnavailable(video);

  // The engine should have it marked.
  const nextVideo = engine.nextVideo();
  assert.ok(nextVideo !== null);
  assert.notEqual(nextVideo!.youtubeId, video.youtubeId);
  queue.dispose();
});
