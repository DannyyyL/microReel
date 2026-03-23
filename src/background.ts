import { AUDIO_STATE_KEY, AudioPreferenceState, resolveVideoMuted } from "./shared/audio";
import { getHostNameFromUrl } from "./shared/hosts";
import { getSettings } from "./shared/settings";

const generatingTabs = new Set<number>();
const MAX_GENERATING_TABS = 64;

type BadgeState = "inactive" | "pending" | "showing";
const VALID_BADGE_STATES = new Set<string>(["inactive", "pending", "showing"]);
const VALID_EVENT_TYPES = new Set<string>(["submitted", "generating-start", "generating-stop"]);

async function setBadgeState(tabId: number, state: BadgeState): Promise<void> {
  if (state === "inactive") {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  if (state === "pending") {
    await chrome.action.setBadgeText({ tabId, text: "..." });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#4f46e5" });
    return;
  }

  await chrome.action.setBadgeText({ tabId, text: "▶" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#4f46e5" });
}

function getTabMutedInfo(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(tab?.mutedInfo?.muted));
    });
  });
}

async function syncAudioStateForTab(tabId: number): Promise<void> {
  try {
    const [pageMuted, settings] = await Promise.all([
      getTabMutedInfo(tabId),
      getSettings()
    ]);

    const audioState: AudioPreferenceState = {
      pageMuted,
      extensionMuted: settings.extensionMuted
    };

    await chrome.storage.local.set({
      [AUDIO_STATE_KEY]: {
        ...audioState,
        videoMuted: resolveVideoMuted(audioState),
        updatedAt: Date.now()
      }
    });

    chrome.tabs.sendMessage(tabId, {
      kind: "MICROREEL_AUDIO_STATE",
      audioState
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // ignore tab/audio sync issues
  }
}

// Accept keepalive ports from content scripts.
// When the extension reloads the port disconnects, which content scripts
// use as a signal to stop their MutationObserver and clean up.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "microreel-keepalive") {
    port.onDisconnect.addListener(() => void 0);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object" || typeof message.kind !== "string") {
    return;
  }

  if (message.kind === "MICROREEL_BADGE_STATE") {
    const tabId = sender.tab?.id;
    const state = typeof message.state === "string" && VALID_BADGE_STATES.has(message.state)
      ? (message.state as BadgeState)
      : null;

    if (typeof tabId === "number" && state) {
      void setBadgeState(tabId, state);
      sendResponse({ ok: true });
      return true;
    }

    sendResponse({ ok: false });
    return false;
  }

  if (message.kind === "MICROREEL_REQUEST_AUDIO_STATE") {
    const tabId = sender.tab?.id;

    if (typeof tabId === "number") {
      void syncAudioStateForTab(tabId);
      sendResponse({ ok: true });
      return true;
    }

    sendResponse({ ok: false });
    return false;
  }

  if (message.kind !== "MICROREEL_EVENT") {
    return;
  }

  const payload = message.payload;
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.type !== "string" ||
    !VALID_EVENT_TYPES.has(payload.type)
  ) {
    sendResponse({ ok: false });
    return false;
  }

  const tabId = sender.tab?.id;

  if (typeof tabId === "number") {
    if (payload.type === "generating-start") {
      if (generatingTabs.size < MAX_GENERATING_TABS) {
        generatingTabs.add(tabId);
      }
    }

    if (payload.type === "generating-stop") {
      generatingTabs.delete(tabId);
    }
  }

  sendResponse({ ok: true });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  generatingTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const nextUrl = typeof changeInfo.url === "string" ? changeInfo.url : null;
  if (nextUrl && !getHostNameFromUrl(nextUrl)) {
    void setBadgeState(tabId, "inactive");
  }

  if (typeof changeInfo.mutedInfo !== "undefined") {
    void syncAudioStateForTab(tabId);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes["microreel.settings"]) {
    return;
  }

  for (const tabId of generatingTabs) {
    void syncAudioStateForTab(tabId);
  }
});
