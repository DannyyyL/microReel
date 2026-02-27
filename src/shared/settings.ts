import { MicroReelSettings } from "./types";

export const SETTINGS_KEY = "microreel.settings";

export const defaultSettings: MicroReelSettings = {
  enabled: true,
  mode: "entertainment",
  position: "top-right",
  startDelayMs: 1200,
  rotationMs: 10000,
  stopOnHostDone: false
};

export async function getSettings(): Promise<MicroReelSettings> {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return {
      ...defaultSettings,
      ...(result[SETTINGS_KEY] ?? {})
    };
  } catch (error) {
    console.debug("microreel: falling back to default settings", error);
    return defaultSettings;
  }
}

export async function setSettings(settings: MicroReelSettings): Promise<void> {
  await chrome.storage.sync.set({
    [SETTINGS_KEY]: settings
  });
}
