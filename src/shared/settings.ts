import { MicroReelSettings } from "./types";

export const SETTINGS_KEY = "microreel.settings";

export const defaultSettings: MicroReelSettings = {
  enabled: true,
  position: "top-right",
  startDelayMs: 1200,
  rotationMs: 10000
};

export async function getSettings(): Promise<MicroReelSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...defaultSettings,
    ...(result[SETTINGS_KEY] ?? {})
  };
}

export async function setSettings(settings: MicroReelSettings): Promise<void> {
  await chrome.storage.sync.set({
    [SETTINGS_KEY]: settings
  });
}
