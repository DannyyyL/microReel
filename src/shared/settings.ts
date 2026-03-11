import { supportedHosts } from "./hosts";
import { HostName, MicroReelSettings, SiteEnabledMap } from "./types";

export const SETTINGS_KEY = "microreel.settings";

export const START_DELAY_LIMITS = { min: 250, max: 10_000 } as const;
export const ROTATION_LIMITS = { min: 3_000, max: 30_000 } as const;

function createDefaultSiteEnabled(): SiteEnabledMap {
  return supportedHosts.reduce((siteEnabled, host) => {
    siteEnabled[host.id] = true;
    return siteEnabled;
  }, {} as SiteEnabledMap);
}

function createDefaultSettings(): MicroReelSettings {
  return {
    enabled: true,
    siteEnabled: createDefaultSiteEnabled(),
    extensionMuted: false,
    mode: "entertainment",
    position: "top-right",
    startDelayMs: 1200,
    rotationMs: 10000,
    stopOnHostDone: false
  };
}

export const defaultSettings: MicroReelSettings = createDefaultSettings();

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeSiteEnabled(value: unknown): SiteEnabledMap {
  const normalized = createDefaultSiteEnabled();

  if (!value || typeof value !== "object") {
    return normalized;
  }

  const partial = value as Partial<Record<HostName, unknown>>;
  for (const host of supportedHosts) {
    if (typeof partial[host.id] === "boolean") {
      normalized[host.id] = partial[host.id] as boolean;
    }
  }

  return normalized;
}

export function normalizeSettings(value: unknown): MicroReelSettings {
  const candidate = typeof value === "object" && value !== null
    ? (value as Partial<MicroReelSettings>)
    : {};

  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : defaultSettings.enabled,
    siteEnabled: normalizeSiteEnabled(candidate.siteEnabled),
    extensionMuted:
      typeof candidate.extensionMuted === "boolean"
        ? candidate.extensionMuted
        : defaultSettings.extensionMuted,
    mode:
      candidate.mode === "education" || candidate.mode === "entertainment"
        ? candidate.mode
        : defaultSettings.mode,
    position:
      candidate.position === "top-right" || candidate.position === "side-right"
        ? candidate.position
        : defaultSettings.position,
    startDelayMs: clampNumber(
      candidate.startDelayMs,
      defaultSettings.startDelayMs,
      START_DELAY_LIMITS.min,
      START_DELAY_LIMITS.max
    ),
    rotationMs: clampNumber(
      candidate.rotationMs,
      defaultSettings.rotationMs,
      ROTATION_LIMITS.min,
      ROTATION_LIMITS.max
    ),
    stopOnHostDone:
      typeof candidate.stopOnHostDone === "boolean"
        ? candidate.stopOnHostDone
        : defaultSettings.stopOnHostDone
  };
}

export async function getSettings(): Promise<MicroReelSettings> {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    return normalizeSettings(result[SETTINGS_KEY]);
  } catch (error) {
    console.debug("microreel: falling back to default settings", error);
    return normalizeSettings(undefined);
  }
}

export async function setSettings(settings: MicroReelSettings): Promise<void> {
  await chrome.storage.sync.set({
    [SETTINGS_KEY]: normalizeSettings(settings)
  });
}

export function isHostEnabled(settings: MicroReelSettings, host: HostName): boolean {
  return settings.siteEnabled[host];
}

export function isFeatureEnabledForHost(settings: MicroReelSettings, host: HostName): boolean {
  return settings.enabled && isHostEnabled(settings, host);
}

export function setHostEnabled(
  settings: MicroReelSettings,
  host: HostName,
  enabled: boolean
): MicroReelSettings {
  return normalizeSettings({
    ...settings,
    siteEnabled: {
      ...settings.siteEnabled,
      [host]: enabled
    }
  });
}
