import { getHostLabel, getHostNameFromUrl, supportedHosts } from "../shared/hosts";
import {
  defaultSettings,
  getSettings,
  isFeatureEnabledForHost,
  setHostEnabled,
  setSettings
} from "../shared/settings";
import { HostName, MicroReelSettings } from "../shared/types";

interface PageContext {
  host: HostName | null;
  url: string | null;
}

const enabledEl = requireElement<HTMLInputElement>("enabled");
const modeEl = requireElement<HTMLSelectElement>("mode");
const siteRowEl = requireElement<HTMLDivElement>("current-site-row");
const siteEnabledEl = requireElement<HTMLInputElement>("site-enabled");
const extensionMutedEl = requireElement<HTMLInputElement>("extension-muted");
const stopOnDoneEl = requireElement<HTMLInputElement>("stop-on-done");
const siteLabelEl = requireElement<HTMLLabelElement>("site-label");
const siteHintEl = requireElement<HTMLParagraphElement>("site-hint");
const contextEl = requireElement<HTMLParagraphElement>("context");
const statusEl = requireElement<HTMLParagraphElement>("status");
const unsupportedEl = requireElement<HTMLParagraphElement>("unsupported-note");
const openOptionsEl = requireElement<HTMLButtonElement>("open-options");

let settings: MicroReelSettings = {
  ...defaultSettings,
  siteEnabled: { ...defaultSettings.siteEnabled }
};
let currentHost: HostName | null = null;
let statusTimer: number | null = null;

enabledEl.addEventListener("change", () => {
  void persist(
    {
      ...settings,
      enabled: enabledEl.checked
    },
    enabledEl.checked ? "MicroReel is on" : "MicroReel is off"
  );
});

modeEl.addEventListener("change", () => {
  void persist(
    {
      ...settings,
      mode: modeEl.value as MicroReelSettings["mode"]
    },
    `Mode set to ${modeEl.value}`
  );
});

extensionMutedEl.addEventListener("change", () => {
  void persist(
    {
      ...settings,
      extensionMuted: extensionMutedEl.checked
    },
    extensionMutedEl.checked ? "MicroReel audio muted" : "MicroReel audio follows the tab"
  );
});

siteEnabledEl.addEventListener("change", () => {
  if (!currentHost) {
    return;
  }

  const hostLabel = getHostLabel(currentHost);
  void persist(
    setHostEnabled(settings, currentHost, siteEnabledEl.checked),
    siteEnabledEl.checked ? `${hostLabel} enabled` : `${hostLabel} paused`
  );
});

stopOnDoneEl.addEventListener("change", () => {
  void persist(
    {
      ...settings,
      stopOnHostDone: stopOnDoneEl.checked
    },
    stopOnDoneEl.checked
      ? "MicroReel now stops as soon as the host finishes"
      : "Lets content finish naturally"
  );
});

openOptionsEl.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void init();

async function init(): Promise<void> {
  settings = await getSettings();
  currentHost = (await resolvePageContext()).host;
  render();
}

async function persist(nextSettings: MicroReelSettings, message: string): Promise<void> {
  settings = nextSettings;
  render();

  try {
    await setSettings(nextSettings);
    showStatus(message);
  } catch {
    showStatus("Could not save settings");
  }
}

function render(): void {
  enabledEl.checked = settings.enabled;
  modeEl.value = settings.mode;
  extensionMutedEl.checked = settings.extensionMuted;
  stopOnDoneEl.checked = settings.stopOnHostDone;
  renderSiteContext();
}

function renderSiteContext(): void {
  if (!currentHost) {
    siteRowEl.hidden = true;
    unsupportedEl.hidden = false;
    contextEl.textContent = `Open ${supportedHosts.map((host) => host.label).join(", ")} to unlock site-specific controls.`;
    unsupportedEl.textContent = "MicroReel still remembers your global mode and timing settings here.";
    return;
  }

  const hostLabel = getHostLabel(currentHost);
  const siteEnabled = settings.siteEnabled[currentHost];
  const activeOnTab = isFeatureEnabledForHost(settings, currentHost);

  siteRowEl.hidden = false;
  unsupportedEl.hidden = true;
  siteEnabledEl.checked = siteEnabled;
  siteLabelEl.textContent = `Show on ${hostLabel}`;
  siteHintEl.textContent = settings.enabled
    ? siteEnabled
      ? `${hostLabel} can display MicroReel on this tab.`
      : `${hostLabel} is paused until you re-enable this site.`
    : `MicroReel is off, so ${hostLabel} stays paused until you turn it back on.`;
  contextEl.textContent = activeOnTab
    ? `${hostLabel} is ready on this tab.`
    : `${hostLabel} is currently paused on this tab.`;
}

function showStatus(message: string): void {
  statusEl.textContent = message;
  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
  }
  statusTimer = window.setTimeout(() => {
    statusEl.textContent = "";
    statusTimer = null;
  }, 1400);
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`microreel popup element not found: ${id}`);
  }
  return element as T;
}

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0] ?? null);
    });
  });
}

function getPageContextFromContentScript(tabId: number): Promise<PageContext | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { kind: "MICROREEL_GET_PAGE_CONTEXT" }, (response) => {
      if (chrome.runtime.lastError || !response || typeof response.host !== "string") {
        resolve(null);
        return;
      }

      resolve({
        host: response.host as HostName,
        url: typeof response.url === "string" ? response.url : null
      });
    });
  });
}

async function resolvePageContext(): Promise<PageContext> {
  const tab = await getActiveTab();
  if (!tab) {
    return { host: null, url: null };
  }

  if (typeof tab.id === "number") {
    const pageContext = await getPageContextFromContentScript(tab.id);
    if (pageContext) {
      return pageContext;
    }
  }

  const url = typeof tab.url === "string" ? tab.url : null;
  return {
    host: url ? getHostNameFromUrl(url) : null,
    url
  };
}
