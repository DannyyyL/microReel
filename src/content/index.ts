import { getSettings, SETTINGS_KEY } from "../shared/settings";
import { MicroContentEngine } from "../shared/microContentEngine";
import { loadVideos } from "../shared/videoLoader";
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

  // Load videos and settings in parallel — fall back to hardcoded list if offline.
  const [videoList, settings0] = await Promise.all([loadVideos(), getSettings()]);

  const engine = new MicroContentEngine(videoList);
  const overlay = new OverlayRenderer();

  let settings = settings0;
  let startTimer: number | null = null;
  let rotationTimer: number | null = null;
  let generationStartedAt = 0;
  let contextAlive = true;
  let pendingHide = false;
  let videoFinished = false;
  let activeGenerationCount = 0;   // incremented per prompt, decremented on stop
  let preloadedResult: import("../shared/microContentEngine").EngineResult | null = null;
  let userManuallyClosed = false;

  overlay.mount();
  overlay.setPosition(settings.position);

  // Listen for manual close events from the overlay
  document.getElementById("microreel-root")?.addEventListener("microreel-manual-close", () => {
    userManuallyClosed = true;
    cleanupTimers();
  });

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
    activeGenerationCount = 0;
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
    preloadedResult = null;
  }

  function showNextContent(): void {
    if (!contextAlive || userManuallyClosed) {
      return;
    }
    // Use the preloaded result (computed at generation-start) if available
    const result = preloadedResult ?? engine.next({
      host: activeAdapter.name,
      elapsedMs: Date.now() - generationStartedAt
    }, settings.mode);
    preloadedResult = null;
    if (result.kind === "video") {
      videoFinished = false;
      overlay.showVideo(result.video, () => {
        videoFinished = true;
        if (pendingHide) {
          // Generation stopped while video was playing — hide now.
          pendingHide = false;
          overlay.hideAll();
        } else if (activeGenerationCount > 0) {
          // Still generating — immediately play the next video.
          showNextContent();
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
      activeGenerationCount++;
      userManuallyClosed = false; // Reset manual close state on new prompt
      // If a video is already playing, let it finish uninterrupted.
      // Just reset pendingHide so the ongoing generation keeps it alive.
      if (settings.mode === "entertainment" && overlay.isVideoVisible()) {
        pendingHide = false;
        videoFinished = false;
        generationStartedAt = Date.now();
        emit("generating-start");
        return;
      }
      pendingHide = false;
      videoFinished = false;
      generationStartedAt = Date.now();
      emit("generating-start");
      cleanupTimers();
      // In entertainment mode, start buffering the next video immediately so it
      // is ready by the time startDelayMs elapses.
      if (settings.mode === "entertainment") {
        preloadedResult = engine.next({
          host: activeAdapter.name,
          elapsedMs: 0
        }, settings.mode);
        if (preloadedResult.kind === "video") {
          overlay.preloadVideo(preloadedResult.video);
        }
      }
      startTimer = window.setTimeout(() => {
        showNextContent();
        rotationTimer = window.setInterval(showNextContent, settings.rotationMs);
      }, settings.startDelayMs);
    },
    onGeneratingStop() {
      if (!contextAlive) {
        return;
      }
      activeGenerationCount = Math.max(0, activeGenerationCount - 1);
      emit("generating-stop");
      // Only act when ALL in-flight generations have finished.
      if (activeGenerationCount > 0) {
        return;
      }
      cleanupTimers();
      if (userManuallyClosed) {
        // User manually closed the video, don't do anything else.
        // Reset for the next cycle.
        userManuallyClosed = false;
        return;
      }
      if (settings.stopOnHostDone) {
        overlay.hideAll();
        return;
      }
      if (settings.mode === "entertainment") {
        if (videoFinished) {
          // Video already ended — hide immediately.
          overlay.hideAll();
        } else {
          // Let the current video finish before hiding.
          pendingHide = true;
        }
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
