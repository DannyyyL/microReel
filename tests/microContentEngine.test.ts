import test from "node:test";
import assert from "node:assert/strict";
import { cards } from "../src/shared/cards";
import { MicroContentEngine } from "../src/shared/microContentEngine";
import { videos } from "../src/shared/videos";

test("education mode avoids repeating the most recent cards when options remain", () => {
  const sequence = [0, 0, 0, 0];
  const engine = new MicroContentEngine(videos, () => sequence.shift() ?? 0);

  const first = engine.next({ host: "chatgpt", elapsedMs: 0 }, "education");
  const second = engine.next({ host: "chatgpt", elapsedMs: 0 }, "education");
  const third = engine.next({ host: "chatgpt", elapsedMs: 0 }, "education");

  assert.equal(first.kind, "card");
  assert.equal(second.kind, "card");
  assert.equal(third.kind, "card");
  assert.notEqual(second.card.id, first.card.id);
  assert.notEqual(third.card.id, second.card.id);
  assert.notEqual(third.card.id, first.card.id);
});

test("education mode keeps the configured ttl when it already exceeds the minimum", () => {
  const engine = new MicroContentEngine(videos, () => 0);
  const result = engine.next({ host: "claude", elapsedMs: 25_000 }, "education");

  assert.equal(result.kind, "card");
  assert.equal(result.card.id, cards[0].id);
  assert.equal(result.card.ttlMs, cards[0].ttlMs);
});

test("entertainment mode rotates through videos before repeating", () => {
  const engine = new MicroContentEngine(videos, () => 0);
  const seen = new Set<string>();

  for (let index = 0; index < 3; index += 1) {
    const result = engine.next({ host: "copilot", elapsedMs: 0 }, "entertainment");
    assert.equal(result.kind, "video");
    assert.ok(!seen.has(result.video.id));
    seen.add(result.video.id);
  }
});

test("entertainment mode skips videos marked unavailable", () => {
  const engine = new MicroContentEngine(videos, () => 0);

  engine.markVideoUnavailable(videos[0]);

  const result = engine.next({ host: "chatgpt", elapsedMs: 0 }, "entertainment");

  assert.equal(result.kind, "video");
  assert.notEqual(result.video.youtubeId, videos[0].youtubeId);
});

test("nextVideo returns null when all videos are unavailable", () => {
  const engine = new MicroContentEngine(videos, () => 0);

  videos.forEach((video) => engine.markVideoUnavailable(video));

  assert.equal(engine.nextVideo(), null);
  assert.equal(engine.hasAvailableVideos(), false);
});
