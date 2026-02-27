import { HostAdapter } from "../shared/types";
import { detectGenerating } from "./hosts";

export type GenerationState = "idle" | "submitted" | "generating";

interface DetectionCallbacks {
  onSubmitted(): void;
  onGeneratingStart(): void;
  onGeneratingStop(): void;
  onError(error: unknown): void;
}

/** How long to wait after the last "not generating" signal before confirming stop. */
const SETTLE_MS = 800;
/** If state stays "submitted" this long with no generation, reset to idle. */
const SUBMITTED_TIMEOUT_MS = 12_000;
/** Minimum interval between evaluation runs (throttle). */
const THROTTLE_MS = 120;
/** Polling interval as a safety-net when MutationObserver misses transitions. */
const POLL_MS = 1_500;

export class GenerationDetector {
  private state: GenerationState = "idle";
  private observer: MutationObserver | null = null;
  private settleTimer: number | null = null;
  private submittedTimer: number | null = null;
  private pollTimer: number | null = null;
  private lastEvalTime = 0;
  private pendingThrottle: number | null = null;

  constructor(
    private readonly adapter: HostAdapter,
    private readonly callbacks: DetectionCallbacks
  ) {}

  start(): void {
    this.attachInputListeners();
    this.attachObserver();
    this.startPolling();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.clearAllTimers();
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

  private attachInputListeners(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) return;
      try {
        if (target.matches(this.adapter.inputSelector)) {
          this.markSubmitted();
        }
      } catch {
        // invalid selector — ignore
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (!target) {
        return;
      }
      try {
        const sender = target.closest(this.adapter.sendButtonSelectors.join(","));
        if (sender) {
          this.markSubmitted();
        }
      } catch {
        // invalid selector — ignore
      }
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
    }, POLL_MS);
  }

  /** Throttle: run evaluate() at most once every THROTTLE_MS. */
  private scheduleEval(): void {
    const now = Date.now();
    if (now - this.lastEvalTime >= THROTTLE_MS) {
      this.evaluate();
    } else if (this.pendingThrottle === null) {
      const delay = THROTTLE_MS - (now - this.lastEvalTime);
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
      const isGenerating = detectGenerating(this.adapter);

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
              if (!detectGenerating(this.adapter)) {
                this.state = "idle";
                this.callbacks.onGeneratingStop();
              }
            } catch (error) {
              this.stop();
              this.callbacks.onError(error);
            }
          }, SETTLE_MS);
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
      }, SUBMITTED_TIMEOUT_MS);
    }
  }
}
