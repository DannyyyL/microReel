import { getSettings, SETTINGS_KEY } from "../shared/settings";
import { MicroContentEngine } from "../shared/microContentEngine";
import { SessionEvent } from "../shared/types";
import { GenerationDetector } from "./detection";
import { getHostAdapter } from "./hosts";
import { OverlayRenderer } from "./overlay";

void (async () => {
  // If the extension was reloaded, old content scripts can outlive the context.
  // Guard chrome API usage to avoid "Extension context invalidated" errors.
  if (!chrome.runtime?.id) {
    console.debug("microreel: extension context invalidated; skipping");
    return;
  }

  const adapter = getHostAdapter();

  // Gracefully no-op on unsupported hosts instead of throwing and spamming console errors.
  if (!adapter) {
    console.debug("microreel: no matching host adapter; skipping");
    return;
  }

  const activeAdapter = adapter;

  const engine = new MicroContentEngine();
  const overlay = new OverlayRenderer();

  let settings = await getSettings();
  let startTimer: number | null = null;
  let rotationTimer: number | null = null;
  let generationStartedAt = 0;
  let contextAlive = true;
  let pendingHide = false;

  overlay.mount();
  overlay.setPosition(settings.position);

  // Proactively detect context invalidation via a persistent port.
  // When the extension is reloaded the port disconnects immediately.
  try {
    const port = chrome.runtime.connect({ name: "microreel-keepalive" });
    port.onDisconnect.addListener(() => {
      contextAlive = false;
      shutdown();
    });
  } catch {
    // Already invalidated before we even started – bail out.
    return;
  }

  function shutdown(): void {
    pendingHide = false;
    cleanupTimers();
    overlay.hideAll();
    overlay.unmount();
    detector?.stop();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!contextAlive || areaName !== "sync" || !changes[SETTINGS_KEY]) {
      return;
    }
    settings = {
      ...settings,
      ...changes[SETTINGS_KEY].newValue
    };
    overlay.setPosition(settings.position);
    if (!settings.enabled) {
      cleanupTimers();
      overlay.hide();
    }
  });

  function emit(type: SessionEvent["type"]): void {
    if (!contextAlive) {
      return;
    }
    const payload: SessionEvent = {
      type,
      host: activeAdapter.name,
      timestamp: Date.now(),
      url: location.href
    };
    try {
      chrome.runtime.sendMessage({ kind: "MICROREEL_EVENT", payload }, () => {
        void chrome.runtime.lastError; // suppress unchecked error warning
      });
    } catch {
      contextAlive = false;
      shutdown();
    }
  }

  function cleanupTimers(): void {
    if (startTimer !== null) {
      window.clearTimeout(startTimer);
      startTimer = null;
    }
    if (rotationTimer !== null) {
      window.clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  function showNextContent(): void {
    if (!contextAlive) {
      return;
    }
    const result = engine.next({
      host: activeAdapter.name,
      elapsedMs: Date.now() - generationStartedAt
    }, settings.mode);
    if (result.kind === "video") {
      overlay.showVideo(result.video, () => {
        // Video finished naturally — if generation has already stopped, hide now.
        if (pendingHide) {
          pendingHide = false;
          overlay.hideAll();
        }
      });
    } else {
      overlay.show(result.card);
    }
  }

  const detector = new GenerationDetector(activeAdapter, {
    onSubmitted() {
      emit("submitted");
    },
    onGeneratingStart() {
      if (!contextAlive || !settings.enabled) {
        return;
      }
      pendingHide = false;
      generationStartedAt = Date.now();
      emit("generating-start");
      cleanupTimers();
      startTimer = window.setTimeout(() => {
        showNextContent();
        rotationTimer = window.setInterval(showNextContent, settings.rotationMs);
      }, settings.startDelayMs);
    },
    onGeneratingStop() {
      if (!contextAlive) {
        return;
      }
      emit("generating-stop");
      cleanupTimers();
      if (settings.mode === "entertainment") {
        // Let the current video finish before hiding.
        pendingHide = true;
      } else {
        overlay.hideAll();
      }
    },
    onError(_error) {
      contextAlive = false;
      shutdown();
    }
  });

  detector.start();
})();
