import { HostAdapter } from "../shared/types";
import { detectGenerating } from "./hosts";

export type GenerationState = "idle" | "submitted" | "generating";

interface DetectionCallbacks {
  onSubmitted(): void;
  onGeneratingStart(): void;
  onGeneratingStop(): void;
  onError(error: unknown): void;
}

export class GenerationDetector {
  private state: GenerationState = "idle";
  private observer: MutationObserver | null = null;
  private settleTimer: number | null = null;

  constructor(
    private readonly adapter: HostAdapter,
    private readonly callbacks: DetectionCallbacks
  ) {}

  start(): void {
    this.attachInputListeners();
    this.attachObserver();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.settleTimer !== null) {
      window.clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private attachInputListeners(): void {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.matches(this.adapter.inputSelector)) {
        this.markSubmitted();
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      if (!target) {
        return;
      }
      const sender = target.closest(this.adapter.sendButtonSelectors.join(","));
      if (sender) {
        this.markSubmitted();
      }
    });
  }

  private attachObserver(): void {
    this.observer = new MutationObserver(() => {
      try {
        const isGenerating = detectGenerating(this.adapter);

        if (isGenerating && this.state !== "generating") {
          this.state = "generating";
          this.callbacks.onGeneratingStart();
          return;
        }

        if (!isGenerating && this.state === "generating") {
          if (this.settleTimer !== null) {
            window.clearTimeout(this.settleTimer);
          }
          this.settleTimer = window.setTimeout(() => {
            try {
              if (!detectGenerating(this.adapter)) {
                this.state = "idle";
                this.callbacks.onGeneratingStop();
              }
            } catch (error) {
              this.stop();
              this.callbacks.onError(error);
            }
          }, 500);
        }
      } catch (error) {
        this.stop();
        this.callbacks.onError(error);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false
    });
  }

  private markSubmitted(): void {
    if (this.state === "idle") {
      this.state = "submitted";
      this.callbacks.onSubmitted();
    }
  }
}
