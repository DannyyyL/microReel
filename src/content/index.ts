import { getSettings, SETTINGS_KEY } from "../shared/settings";
import { MicroContentEngine } from "../shared/microContentEngine";
import { SessionEvent } from "../shared/types";
import { GenerationDetector } from "./detection";
import { getHostAdapter } from "./hosts";
import { OverlayRenderer } from "./overlay";

const adapter = getHostAdapter();

if (!adapter) {
  throw new Error("microreel host adapter not found");
}

const activeAdapter = adapter;

const engine = new MicroContentEngine();
const overlay = new OverlayRenderer();

let settings = await getSettings();
let startTimer: number | null = null;
let rotationTimer: number | null = null;
let generationStartedAt = 0;

overlay.mount();
overlay.setPosition(settings.position);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[SETTINGS_KEY]) {
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
  const payload: SessionEvent = {
    type,
    host: activeAdapter.name,
    timestamp: Date.now(),
    url: location.href
  };
  chrome.runtime.sendMessage({ kind: "MICROREEL_EVENT", payload }).catch(() => undefined);
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

function showNextCard(): void {
  const card = engine.next({
    host: activeAdapter.name,
    elapsedMs: Date.now() - generationStartedAt
  });
  overlay.show(card);
}

const detector = new GenerationDetector(activeAdapter, {
  onSubmitted() {
    emit("submitted");
  },
  onGeneratingStart() {
    if (!settings.enabled) {
      return;
    }
    generationStartedAt = Date.now();
    emit("generating-start");
    cleanupTimers();
    startTimer = window.setTimeout(() => {
      showNextCard();
      rotationTimer = window.setInterval(showNextCard, settings.rotationMs);
    }, settings.startDelayMs);
  },
  onGeneratingStop() {
    emit("generating-stop");
    cleanupTimers();
    overlay.hide();
  }
});

detector.start();
