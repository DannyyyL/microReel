import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import {
  defaultDetectionTimings,
  DetectionCallbacks,
  GenerationDetector
} from "../src/content/detection";
import { OverlayRenderer } from "../src/content/overlay";
import { resolveVideoMuted } from "../src/shared/audio";
import { HostAdapter } from "../src/shared/types";

const adapter: HostAdapter = {
  name: "chatgpt",
  matches: () => true,
  inputSelector: "textarea",
  sendButtonSelectors: ["button.send"],
  stopButtonSelectors: ["button.stop"],
  typingIndicatorSelectors: [".typing"],
  streamRootSelectors: ["main"]
};

function createCallbacks(events: string[]): DetectionCallbacks {
  return {
    onSubmitted: () => events.push("submitted"),
    onGeneratingStart: () => events.push("start"),
    onGeneratingStop: () => events.push("stop"),
    onUserStopRequested: () => events.push("user-stop"),
    onError: (error) => {
      throw error;
    }
  };
}

async function flushTimers(iterations = 3): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function installDomGlobals(window: Window): () => void {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalMutationObserver = globalThis.MutationObserver;
  const originalLocation = globalThis.location;

  Object.assign(globalThis, {
    window,
    document: window.document,
    MutationObserver: window.MutationObserver,
    location: window.location
  });

  return () => {
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }

    if (originalDocument) {
      globalThis.document = originalDocument;
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }

    if (originalMutationObserver) {
      globalThis.MutationObserver = originalMutationObserver;
    } else {
      Reflect.deleteProperty(globalThis, "MutationObserver");
    }

    if (originalLocation) {
      globalThis.location = originalLocation;
    } else {
      Reflect.deleteProperty(globalThis, "location");
    }
  };
}

test("GenerationDetector submits, starts, and stops based on DOM signals", async () => {
  const window = new Window({ url: "https://chatgpt.com" });
  const { document } = window;
  document.body.innerHTML = '<textarea></textarea><button class="send">Send</button>';

  const events: string[] = [];
  const restore = installDomGlobals(window);

  let generating = false;
  const detector = new GenerationDetector(
    adapter,
    createCallbacks(events),
    () => generating,
    {
      ...defaultDetectionTimings,
      settleMs: 10,
      submittedTimeoutMs: 30,
      throttleMs: 0,
      pollMs: 1000
    }
  );

  detector.start();

  try {
    const textarea = document.querySelector("textarea");
    assert.ok(textarea instanceof window.HTMLTextAreaElement);

    textarea.dispatchEvent(new window.KeyboardEvent("keydown", {
      bubbles: true,
      key: "Enter"
    }));
    await flushTimers();
    assert.deepEqual(events, ["submitted"]);

    generating = true;
    document.body.appendChild(document.createElement("div"));
    await flushTimers();
    assert.deepEqual(events, ["submitted", "start"]);

    generating = false;
    document.body.appendChild(document.createElement("div"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushTimers();
    assert.deepEqual(events, ["submitted", "start", "stop"]);
  } finally {
    detector.stop();
    restore();
    window.close();
  }
});

test("GenerationDetector removes listeners when stopped", async () => {
  const window = new Window({ url: "https://chatgpt.com" });
  const { document } = window;
  document.body.innerHTML = '<textarea></textarea><button class="stop">Stop</button>';

  const events: string[] = [];
  const restore = installDomGlobals(window);

  const detector = new GenerationDetector(
    adapter,
    createCallbacks(events),
    () => false,
    {
      ...defaultDetectionTimings,
      throttleMs: 0,
      pollMs: 1000
    }
  );

  detector.start();
  detector.stop();

  try {
    const stopButton = document.querySelector("button.stop");
    assert.ok(stopButton instanceof window.HTMLButtonElement);

    stopButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await flushTimers();
    assert.deepEqual(events, []);
  } finally {
    restore();
    window.close();
  }
});

test("OverlayRenderer reports unavailable YouTube embeds", async () => {
  const window = new Window({ url: "https://chatgpt.com" });
  const { document } = window;
  const restore = installDomGlobals(window);
  const overlay = new OverlayRenderer();
  const events: string[] = [];

  overlay.mount();

  try {
    overlay.showVideo(
      {
        id: "bad-video",
        title: "Missing video",
        youtubeId: "missing1234",
        ttlMs: 20_000
      },
      {
        onUnavailable: () => events.push("unavailable")
      }
    );

    window.dispatchEvent(new window.MessageEvent("message", {
      origin: "https://www.youtube.com",
      data: JSON.stringify({ event: "onError", info: 150 })
    }));

    await flushTimers();
    assert.deepEqual(events, ["unavailable"]);
    const overlayRoot = document.getElementById("microreel-root");
    assert.ok(overlayRoot);
    assert.ok(document.body.contains(overlayRoot));
  } finally {
    overlay.unmount();
    restore();
    window.close();
  }
});

test("resolveVideoMuted mutes when either the tab or extension is muted", () => {
  assert.equal(resolveVideoMuted({ pageMuted: false, extensionMuted: false }), false);
  assert.equal(resolveVideoMuted({ pageMuted: true, extensionMuted: false }), true);
  assert.equal(resolveVideoMuted({ pageMuted: false, extensionMuted: true }), true);
});
