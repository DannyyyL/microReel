import { HostAdapter } from "../shared/types";
import { detectGenerating } from "./hosts";

export type GenerationState = "idle" | "submitted" | "generating";

export interface DetectionCallbacks {
  onSubmitted(): void;
  onGeneratingStart(): void;
  onGeneratingStop(): void;
  onUserStopRequested(): void;
  onError(error: unknown): void;
}

/** How long to wait after the last "not generating" signal before confirming stop. */
export const defaultDetectionTimings = {
  settleMs: 800,
  submittedTimeoutMs: 12_000,
  throttleMs: 120,
  pollMs: 800
} as const;

export interface DetectionTimingConfig {
  settleMs?: number;
  submittedTimeoutMs?: number;
  throttleMs?: number;
  pollMs?: number;
}

type ResolvedDetectionTimings = {
  settleMs: number;
  submittedTimeoutMs: number;
  throttleMs: number;
  pollMs: number;
};

export class GenerationDetector {
  private state: GenerationState = "idle";
  private observer: MutationObserver | null = null;
  private cleanupListeners: Array<() => void> = [];
  private settleTimer: number | null = null;
  private submittedTimer: number | null = null;
  private pollTimer: number | null = null;
  private lastEvalTime = 0;
  private pendingThrottle: number | null = null;

  private readonly timings: ResolvedDetectionTimings;

  constructor(
    private readonly adapter: HostAdapter,
    private readonly callbacks: DetectionCallbacks,
    private readonly detectGeneratingFn: (adapter: HostAdapter) => boolean = detectGenerating,
    timings: DetectionTimingConfig = {}
  ) {
    this.timings = {
      ...defaultDetectionTimings,
      ...timings
    };
  }

  start(): void {
    this.attachInputListeners();
    this.attachObserver();
    this.startPolling();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.clearAllTimers();
    this.cleanupListeners.forEach((cleanup) => cleanup());
    this.cleanupListeners = [];
  }

  private clearAllTimers(): void {
    if (this.settleTimer !== null) {
      window.clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.submittedTimer !== null) {
      window.clearTimeout(this.submittedTimer);
      this.submittedTimer = null;
    }
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pendingThrottle !== null) {
      window.clearTimeout(this.pendingThrottle);
      this.pendingThrottle = null;
    }
  }

  private addDocumentListener<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void
  ): void {
    document.addEventListener(type, listener as EventListener, true);
    this.cleanupListeners.push(() => {
      document.removeEventListener(type, listener as EventListener, true);
    });
  }

  private attachInputListeners(): void {
    // Use capture phase so we see events before the host UI can stopPropagation.
    this.addDocumentListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) return;
      try {
        // closest() handles child elements inside contenteditable / textarea wrappers
        if (target.closest(this.adapter.inputSelector)) {
          this.markSubmitted();
        }
      } catch {
        // invalid selector — ignore
      }
    });

    const handleSendClick = (event: Event): void => {
      const target = event.target as Element | null;
      if (!target) return;
      try {
        if (target.closest(this.adapter.sendButtonSelectors.join(","))) {
          this.markSubmitted();
        }
      } catch {
        // invalid selector — ignore
      }
    };

    // Listen on both click and pointerdown (some hosts consume click before it bubbles).
    this.addDocumentListener("click", handleSendClick);
    this.addDocumentListener("pointerdown", handleSendClick);

    const handleStopClick = (event: Event): void => {
      const target = event.target as Element | null;
      if (!target) return;
      try {
        if (target.closest(this.adapter.stopButtonSelectors.join(","))) {
          this.callbacks.onUserStopRequested();
        }
      } catch {
        // invalid selector — ignore
      }
    };

    this.addDocumentListener("click", handleStopClick);
    this.addDocumentListener("pointerdown", handleStopClick);

    // Catch form-based submissions (e.g. Copilot's <form> wrapper).
    this.addDocumentListener("submit", () => {
      this.markSubmitted();
    });
  }

  private attachObserver(): void {
    this.observer = new MutationObserver(() => {
      this.scheduleEval();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false
    });
  }

  /** Start a polling check as a safety-net for transitions the observer may miss. */
  private startPolling(): void {
    this.pollTimer = window.setInterval(() => {
      this.evaluate();
    }, this.timings.pollMs);
  }

  /** Throttle: run evaluate() at most once every throttleMs. */
  private scheduleEval(): void {
    const now = Date.now();
    if (now - this.lastEvalTime >= this.timings.throttleMs) {
      this.evaluate();
    } else if (this.pendingThrottle === null) {
      const delay = this.timings.throttleMs - (now - this.lastEvalTime);
      this.pendingThrottle = window.setTimeout(() => {
        this.pendingThrottle = null;
        this.evaluate();
      }, delay);
    }
  }

  /** Core evaluation — checks DOM and transitions state. */
  private evaluate(): void {
    this.lastEvalTime = Date.now();
    try {
      const isGenerating = this.detectGeneratingFn(this.adapter);

      const canStartGenerating =
        this.state === "submitted" || this.adapter.name !== "gemini";

      if (isGenerating && this.state !== "generating" && canStartGenerating) {
        this.cancelSettleTimer();
        this.cancelSubmittedTimer();
        this.state = "generating";
        this.callbacks.onGeneratingStart();
        return;
      }

      if (!isGenerating && this.state === "generating") {
        if (this.settleTimer === null) {
          this.settleTimer = window.setTimeout(() => {
            this.settleTimer = null;
            try {
              if (!this.detectGeneratingFn(this.adapter)) {
                this.state = "idle";
                this.callbacks.onGeneratingStop();
              }
            } catch (error) {
              this.stop();
              this.callbacks.onError(error);
            }
          }, this.timings.settleMs);
        }
      } else if (isGenerating && this.state === "generating") {
        // Still generating — cancel any pending settle
        this.cancelSettleTimer();
      }
    } catch (error) {
      this.stop();
      this.callbacks.onError(error);
    }
  }

  private cancelSettleTimer(): void {
    if (this.settleTimer !== null) {
      window.clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private cancelSubmittedTimer(): void {
    if (this.submittedTimer !== null) {
      window.clearTimeout(this.submittedTimer);
      this.submittedTimer = null;
    }
  }

  private markSubmitted(): void {
    if (this.state === "idle" || this.state === "submitted") {
      this.state = "submitted";
      this.callbacks.onSubmitted();
      // Safety: if generation never starts, reset submitted → idle
      this.cancelSubmittedTimer();
      this.submittedTimer = window.setTimeout(() => {
        this.submittedTimer = null;
        if (this.state === "submitted") {
          this.state = "idle";
        }
      }, this.timings.submittedTimeoutMs);
    }
  }
}
