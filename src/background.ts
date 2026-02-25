import { SessionEvent } from "./shared/types";

const generatingTabs = new Set<number>();

// Accept keepalive ports from content scripts.
// When the extension reloads the port disconnects, which content scripts
// use as a signal to stop their MutationObserver and clean up.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "microreel-keepalive") {
    port.onDisconnect.addListener(() => void 0);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind !== "MICROREEL_EVENT") {
    return;
  }

  const payload = message.payload as SessionEvent;
  const tabId = sender.tab?.id;

  if (typeof tabId === "number") {
    if (payload.type === "generating-start") {
      generatingTabs.add(tabId);
      void chrome.action.setBadgeText({ tabId, text: "ON" });
      void chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
    }

    if (payload.type === "generating-stop") {
      generatingTabs.delete(tabId);
      void chrome.action.setBadgeText({ tabId, text: "" });
    }
  }

  sendResponse({ ok: true });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  generatingTabs.delete(tabId);
});
