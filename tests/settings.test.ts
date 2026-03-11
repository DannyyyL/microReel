import test from "node:test";
import assert from "node:assert/strict";
import { supportedHosts } from "../src/shared/hosts";
import {
  defaultSettings,
  isFeatureEnabledForHost,
  normalizeSettings,
  ROTATION_LIMITS,
  setHostEnabled,
  START_DELAY_LIMITS
} from "../src/shared/settings";

test("normalizeSettings fills in missing site flags for older saved state", () => {
  const normalized = normalizeSettings({ enabled: true, mode: "education" });

  for (const host of supportedHosts) {
    assert.equal(normalized.siteEnabled[host.id], true);
  }
  assert.equal(normalized.mode, "education");
  assert.equal(normalized.position, defaultSettings.position);
  assert.equal(normalized.extensionMuted, defaultSettings.extensionMuted);
});

test("normalizeSettings clamps numeric fields to safe limits", () => {
  const normalized = normalizeSettings({
    startDelayMs: 10,
    rotationMs: 1_000_000,
    stopOnHostDone: true
  });

  assert.equal(normalized.startDelayMs, START_DELAY_LIMITS.min);
  assert.equal(normalized.rotationMs, ROTATION_LIMITS.max);
  assert.equal(normalized.stopOnHostDone, true);
});

test("setHostEnabled only disables the targeted host", () => {
  const updated = setHostEnabled(defaultSettings, "claude", false);

  assert.equal(updated.siteEnabled.claude, false);
  assert.equal(updated.siteEnabled.chatgpt, true);
  assert.equal(isFeatureEnabledForHost(updated, "claude"), false);
  assert.equal(isFeatureEnabledForHost(updated, "chatgpt"), true);
});
