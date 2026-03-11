import {
  getSettings,
  isFeatureEnabledForHost,
  normalizeSettings,
  SETTINGS_KEY
} from "../shared/settings";
import { MicroContentEngine } from "../shared/microContentEngine";
import { loadVideos } from "../shared/videoLoader";
import { VideoPreloadQueue } from "../shared/videoPreloadQueue";
import { AudioPreferenceState } from "../shared/audio";
import { SessionEvent, VideoCard } from "../shared/types";
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
  const preloadQueue = new VideoPreloadQueue(engine, { targetSize: 3 });

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
  let blockNextContent = false;
  let audioState: AudioPreferenceState = {
    pageMuted: false,
    extensionMuted: settings.extensionMuted
  };

  overlay.mount();
  overlay.setPosition(settings.position);
  overlay.setAudioState(audioState);

  // ── Aggressive preloading at page load ──────────────────────────────────
  // Start background validation immediately so videos are ready before the
  // user even submits a prompt. Once validated, preload the first video's
  // iframe so it's buffered and can play instantly.
  if (settings.mode === "entertainment" && isFeatureEnabledForHost(settings, activeAdapter.name)) {
    preloadQueue.fill();
    // Wait a moment for the first validation to finish, then preload the iframe.
    scheduleIdlePreload();
  }

  /**
   * Schedule iframe preloading at idle time. Uses requestIdleCallback where
   * available, falling back to a short setTimeout.
   */
  function scheduleIdlePreload(): void {
    const doPreload = () => {
      if (!contextAlive) return;
      const video = preloadQueue.peek();
      if (video) {
        overlay.preloadVideo(video);
        console.debug("microreel: idle-preloaded video", video.youtubeId);
      } else {
        // Queue not filled yet — retry after a short delay.
        window.setTimeout(() => {
          if (!contextAlive) return;
          const v = preloadQueue.peek();
          if (v) overlay.preloadVideo(v);
        }, 1500);
      }
    };

    if (typeof (window as unknown as Record<string, unknown>).requestIdleCallback === "function") {
      (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(doPreload, { timeout: 3000 });
    } else {
      setTimeout(doPreload, 500);
    }
  }

  try {
    chrome.runtime.sendMessage({ kind: "MICROREEL_REQUEST_AUDIO_STATE" }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // ignore audio sync bootstrap errors
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.kind !== "MICROREEL_GET_PAGE_CONTEXT") {
      if (message?.kind === "MICROREEL_AUDIO_STATE" && message.audioState) {
        audioState = {
          pageMuted: Boolean(message.audioState.pageMuted),
          extensionMuted: Boolean(message.audioState.extensionMuted)
        };
        overlay.setAudioState(audioState);
      }
      return;
    }

    sendResponse({
      host: activeAdapter.name,
      url: location.href
    });
  });

  function isActiveOnCurrentSite(): boolean {
    return isFeatureEnabledForHost(settings, activeAdapter.name);
  }

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
    preloadQueue.dispose();
    detector?.stop();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!contextAlive || areaName !== "sync" || !changes[SETTINGS_KEY]) {
      return;
    }
    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    audioState = {
      ...audioState,
      extensionMuted: settings.extensionMuted
    };
    overlay.setPosition(settings.position);
    overlay.setAudioState(audioState);
    if (!isActiveOnCurrentSite()) {
      if (activeGenerationCount > 0) {
        emit("generating-stop");
      }
      activeGenerationCount = 0;
      pendingHide = false;
      blockNextContent = false;
      cleanupTimers();
      overlay.hideAll();
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

  /**
   * Preload the next video from the queue into the overlay's second iframe
   * so it's ready for instant playback when the current video ends.
   */
  function preloadNextFromQueue(): void {
    const next = preloadQueue.peek();
    if (next) {
      overlay.preloadVideo(next);
    }
  }

  function showNextContent(): void {
    if (!contextAlive || userManuallyClosed || blockNextContent) {
      return;
    }

    if (settings.mode === "entertainment") {
      // Try to get a pre-validated video from the queue.
      const video = preloadedResult?.kind === "video"
        ? (preloadedResult.video as VideoCard)
        : preloadQueue.take();
      preloadedResult = null;

      if (video) {
        videoFinished = false;
        overlay.showVideo(video, {
          onEnded: () => {
            videoFinished = true;
            if (pendingHide || blockNextContent) {
              pendingHide = false;
              overlay.hideAll();
            } else if (activeGenerationCount > 0) {
              showNextContent();
            }
          },
          onUnavailable: () => {
            void handleUnavailableVideo(video);
          }
        });
        // Start preloading the next video into the second iframe.
        preloadNextFromQueue();
        return;
      }
      // Queue empty — nothing to show.
      return;
    }

    // Education mode — cards
    const result = preloadedResult ?? engine.next({
      host: activeAdapter.name,
      elapsedMs: Date.now() - generationStartedAt
    }, settings.mode);
    preloadedResult = null;
    if (result.kind === "video") {
      videoFinished = false;
      overlay.showVideo(result.video, {
        onEnded: () => {
          videoFinished = true;
          if (pendingHide || blockNextContent) {
            pendingHide = false;
            overlay.hideAll();
          } else if (activeGenerationCount > 0) {
            showNextContent();
          }
        },
        onUnavailable: () => {
          void handleUnavailableVideo(result.video);
        }
      });
    } else {
      overlay.show(result.card);
    }
  }

  async function handleUnavailableVideo(video: VideoCard): Promise<void> {
    await preloadQueue.markUnavailable(video);

    if (!contextAlive) {
      return;
    }

    if (settings.mode !== "entertainment") {
      overlay.hideAll();
      return;
    }

    // Try the next video from the queue.
    const nextVideo = preloadQueue.take();
    if (nextVideo) {
      preloadedResult = { kind: "video", video: nextVideo };
      showNextContent();
      return;
    }

    pendingHide = false;
    videoFinished = true;
    overlay.hideAll();
  }

  const detector = new GenerationDetector(activeAdapter, {
    onSubmitted() {
      if (!isActiveOnCurrentSite()) {
        return;
      }
      emit("submitted");
    },
    onUserStopRequested() {
      if (!isActiveOnCurrentSite()) {
        return;
      }
      // Block new content but let the current video finish naturally.
      blockNextContent = true;
      preloadedResult = null;
      cleanupTimers();
    },
    onGeneratingStart() {
      if (!contextAlive || !isActiveOnCurrentSite()) {
        return;
      }
      blockNextContent = false;
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

      // In entertainment mode, the video is already preloaded (iframe buffered
      // at page load or after the previous video started). Just grab the next
      // validated video from the queue and show it after startDelayMs.
      if (settings.mode === "entertainment") {
        // Ensure the queue is being filled.
        preloadQueue.fill();
        const video = preloadQueue.take();
        if (video) {
          preloadedResult = { kind: "video", video };
        }
        startTimer = window.setTimeout(() => {
          showNextContent();
        }, settings.startDelayMs);
        return;
      }

      startTimer = window.setTimeout(() => {
        showNextContent();
        // Only rotate on a timer for cards — videos chain via their onEnded
        // callback, so the rotation timer would cut them off mid-playback.
        if (settings.mode !== "entertainment") {
          rotationTimer = window.setInterval(showNextContent, settings.rotationMs);
        }
      }, settings.startDelayMs);
    },
    onGeneratingStop() {
      if (!contextAlive || activeGenerationCount === 0) {
        return;
      }
      activeGenerationCount = Math.max(0, activeGenerationCount - 1);
      emit("generating-stop");
      // Only act when ALL in-flight generations have finished.
      if (activeGenerationCount > 0) {
        return;
      }

      // Block any further chaining for this cycle.
      blockNextContent = true;

      // If the start-delay timer is still pending the overlay was never shown.
      const overlayNeverShown = startTimer !== null;
      const savedPreload = preloadedResult;
      cleanupTimers();

      if (userManuallyClosed) {
        userManuallyClosed = false;
        return;
      }

      if (overlayNeverShown) {
        // Generation was shorter than startDelayMs — show content now,
        // then let it finish naturally before hiding.
        preloadedResult = savedPreload;
        showNextContent();
        // blockNextContent is already true, so the onEnded callback will hide.
        if (settings.mode !== "entertainment") {
          // Show the card for one rotation cycle, then hide.
          rotationTimer = window.setTimeout(() => {
            rotationTimer = null;
            overlay.hideAll();
          }, settings.rotationMs);
        }
        return;
      }

      if (settings.stopOnHostDone) {
        // User opted to stop immediately when host finishes.
        overlay.hideAll();
        return;
      }

      if (settings.mode === "entertainment") {
        if (videoFinished) {
          // Video already ended — hide immediately.
          overlay.hideAll();
        } else {
          // Let the current video finish before hiding.
          // The onEnded callback checks blockNextContent and will hideAll.
          pendingHide = true;
        }
      } else {
        overlay.hideAll();
      }

      // Re-preload for the next generation cycle.
      if (settings.mode === "entertainment") {
        preloadQueue.fill();
        scheduleIdlePreload();
      }
    },
    onError(_error) {
      contextAlive = false;
      shutdown();
    }
  });

  detector.start();
})();
