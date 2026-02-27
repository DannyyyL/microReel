import { MicroCard, OverlayPosition, VideoCard } from "../shared/types";

const GEOMETRY_KEY = "microreel.geometry";
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;

interface StoredGeometry {
  left: number;
  top: number;
  width: number;
}

export class OverlayRenderer {
  private readonly host: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private readonly wrap: HTMLDivElement;
  private readonly cardEl: HTMLDivElement;
  private readonly videoWrap: HTMLDivElement;
  private readonly videoIframe: HTMLIFrameElement;
  private readonly iframeCover: HTMLDivElement;
  private playNudgeTimers: number[] = [];
  private onVideoEndedCallback: (() => void) | null = null;
  private fallbackTimer: number | null = null;
  private listeningInterval: number | null = null;
  private readonly messageHandler: (event: MessageEvent) => void;
  private preloadedVideoId: string | null = null;
  // Ignore ended events briefly after loading a new video to prevent
  // YouTube's rapid onStateChange=0 + infoDelivery double-fire from chaining twice.
  private videoTransitionUntil = 0;
  private endingGuard = false;

  // Drag state
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  // Resize state
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  // Whether the user has manually positioned the overlay
  private hasMoved = false;

  constructor() {
    this.host = document.createElement("div");
    this.host.id = "microreel-root";
    this.shadowRoot = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .wrap {
        position: fixed;
        z-index: 2147483647;
        top: 24px;
        right: 24px;
        width: 300px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        /* hidden when idle */
        pointer-events: none;
        opacity: 0;
        border-radius: 14px;
        box-shadow: none;
        transition: box-shadow 250ms ease, opacity 200ms ease;
      }
      .wrap.has-content {
        opacity: 1;
        pointer-events: auto;
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.13),
          0 8px 40px rgba(0, 0, 0, 0.55);
      }
      .wrap.side-right {
        top: 50%;
        transform: translateY(-50%);
      }

      /* ── Drag handle — floats over top of content, always dim when content visible ── */
      .drag-handle {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 24px;
        cursor: grab;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 300ms ease;
        user-select: none;
        border-radius: 14px 14px 0 0;
      }
      /* dim but always present when there is content */
      .wrap.has-content .drag-handle { opacity: 0.45; }
      /* bright on actual hover */
      .wrap:hover .drag-handle { opacity: 1; }
      .drag-handle:active { cursor: grabbing; }
      .drag-dots {
        display: grid;
        grid-template-columns: repeat(6, 5px);
        grid-template-rows: repeat(2, 5px);
        gap: 2px;
      }
      .drag-dots span {
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.35);
      }
      .drag-handle .close-btn {
        position: absolute;
        top: 2px;
        right: 6px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(0, 0, 0, 0.45);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        line-height: 1;
        padding-bottom: 2px;
        cursor: pointer;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 200ms ease, background 200ms ease;
      }
      .wrap.video-active .drag-handle .close-btn { opacity: 0.9; }
      .wrap:hover.video-active .drag-handle .close-btn { opacity: 1; }
      .drag-handle .close-btn:hover { background: rgba(0, 0, 0, 0.72); }

      /* ── Resize handle ── */
      .resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 300ms ease;
        background: linear-gradient(
          135deg,
          transparent 40%,
          rgba(255,255,255,0.3) 40%,
          rgba(255,255,255,0.3) 55%,
          transparent 55%,
          transparent 65%,
          rgba(255,255,255,0.3) 65%
        );
        border-radius: 0 0 14px 0;
      }
      .wrap.has-content .resize-handle { opacity: 0.45; }
      .wrap:hover .resize-handle { opacity: 1; }
      .wrap:not(.has-content) .drag-handle,
      .wrap:not(.has-content) .resize-handle {
        display: none;
      }

      /* ── Iframe cover — blocks iframe from stealing events during drag/resize ── */
      .iframe-cover {
        display: none;
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: auto;
        cursor: inherit;
      }
      .iframe-cover.active { display: block; }

      /* ── Card — pointer-events: none so text clicks fall through to the page ── */
      .card {
        background: rgba(17, 24, 39, 0.95);
        color: #ffffff;
        border-radius: 14px;
        padding: 16px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 250ms ease, transform 250ms ease;
        pointer-events: none;
      }
      .card.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .title {
        font-size: 15px;
        font-weight: 700;
        margin: 0 0 8px;
      }
      .body {
        margin: 0;
        font-size: 13px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.9);
      }
      .cta {
        margin-top: 10px;
        font-size: 12px;
        opacity: 0.85;
      }

      /* ── Video ── */
      .video-wrap {
        border-radius: 14px;
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 250ms ease, transform 250ms ease;
        pointer-events: auto;
        background: #000;
        position: relative;
      }
      .video-wrap.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .video-wrap iframe {
        display: block;
        width: 100%;
        aspect-ratio: 9 / 16;
        border: none;
        position: relative;
        z-index: 1;
      }

      @media (prefers-reduced-motion: reduce) {
        .card, .video-wrap, .drag-handle, .resize-handle { transition: none; }
      }
    `;

    this.wrap = document.createElement("div");
    this.wrap.className = "wrap";

    // Drag handle (dots grid)
    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    const dots = document.createElement("div");
    dots.className = "drag-dots";
    for (let i = 0; i < 12; i++) dots.appendChild(document.createElement("span"));
    dragHandle.appendChild(dots);

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Close video");
    closeBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.hideAll();
      this.host.dispatchEvent(new CustomEvent("microreel-manual-close"));
    });
    dragHandle.appendChild(closeBtn);

    this.cardEl = document.createElement("div");
    this.cardEl.className = "card";
    this.cardEl.innerHTML = '<h4 class="title"></h4><p class="body"></p><div class="cta"></div>';

    this.videoWrap = document.createElement("div");
    this.videoWrap.className = "video-wrap";
    this.videoIframe = document.createElement("iframe");
    this.videoIframe.allow = "autoplay; encrypted-media";
    this.videoIframe.setAttribute("allowfullscreen", "");
    this.iframeCover = document.createElement("div");
    this.iframeCover.className = "iframe-cover";

    this.videoWrap.append(this.videoIframe, this.iframeCover);

    // Resize handle
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";

    this.wrap.append(dragHandle, this.cardEl, this.videoWrap, resizeHandle);
    this.shadowRoot.append(style, this.wrap);

    this.messageHandler = (event: MessageEvent) => {
      try {
        const raw = event.data;
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (typeof data !== "object" || data === null) {
          return;
        }
        // Guard: ignore ended events within 3s of starting a new video to prevent
        // YouTube's near-simultaneous onStateChange+infoDelivery double-fire.
        if (Date.now() < this.videoTransitionUntil) {
          return;
        }
        const ended =
          (data.event === "onStateChange" && data.info === 0) ||
          (data.event === "infoDelivery" && data.info?.playerState === 0);
        if (ended) {
          this.triggerEnded();
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", this.messageHandler);

    this.initDrag(dragHandle);
    this.initResize(resizeHandle);
  }

  // ── Drag ────────────────────────────────────────────────────────────────────

  private initDrag(handle: HTMLDivElement): void {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const rect = this.wrap.getBoundingClientRect();
      this.moveToAbsolute(rect.left, rect.top);
      this.dragOffsetX = e.clientX - rect.left;
      this.dragOffsetY = e.clientY - rect.top;
      this.isDragging = true;
      this.iframeCover.classList.add("active");
      this.wrap.style.transition = "none";
    });
    handle.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const newLeft = e.clientX - this.dragOffsetX;
      const newTop = e.clientY - this.dragOffsetY;
      const maxLeft = window.innerWidth - this.wrap.offsetWidth;
      const maxTop = window.innerHeight - this.wrap.offsetHeight;
      this.wrap.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
      this.wrap.style.top = `${Math.max(0, Math.min(newTop, maxTop))}px`;
    });
    handle.addEventListener("pointerup", () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.iframeCover.classList.remove("active");
      this.wrap.style.transition = "";
      this.saveGeometry();
    });
  }

  // ── Resize ──────────────────────────────────────────────────────────────────

  private initResize(handle: HTMLDivElement): void {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      this.resizeStartX = e.clientX;
      this.resizeStartWidth = this.wrap.offsetWidth;
      this.isResizing = true;
      this.iframeCover.classList.add("active");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!this.isResizing) return;
      const newWidth = this.resizeStartWidth + (e.clientX - this.resizeStartX);
      this.wrap.style.width = `${Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH))}px`;
    });
    handle.addEventListener("pointerup", () => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.iframeCover.classList.remove("active");
      this.saveGeometry();
    });
  }

  // ── Geometry persistence ────────────────────────────────────────────────────

  private moveToAbsolute(left: number, top: number): void {
    this.wrap.style.right = "auto";
    this.wrap.style.left = `${left}px`;
    this.wrap.style.top = `${top}px`;
    this.wrap.classList.remove("side-right");
    this.hasMoved = true;
  }

  private saveGeometry(): void {
    const rect = this.wrap.getBoundingClientRect();
    const geometry: StoredGeometry = {
      left: rect.left,
      top: rect.top,
      width: this.wrap.offsetWidth
    };
    try {
      void chrome.storage.local.set({ [GEOMETRY_KEY]: geometry });
    } catch {
      // storage unavailable
    }
  }

  async loadGeometry(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(GEOMETRY_KEY);
      const g = result[GEOMETRY_KEY] as StoredGeometry | undefined;
      if (!g) return;
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(g.width, MAX_WIDTH));
      const maxLeft = window.innerWidth - clampedWidth;
      const maxTop = window.innerHeight - 60;
      this.wrap.style.width = `${clampedWidth}px`;
      this.moveToAbsolute(
        Math.max(0, Math.min(g.left, maxLeft)),
        Math.max(0, Math.min(g.top, maxTop))
      );
    } catch {
      // ignore — use CSS default position
    }
  }

  /** Tell the YouTube embed to start sending state-change events. */
  private startListeningHandshake(): void {
    this.stopListeningHandshake();
    // YouTube requires us to post {"event":"listening"} to the iframe
    // repeatedly until it acknowledges. We retry every 250ms for up to 5s.
    let attempts = 0;
    this.listeningInterval = window.setInterval(() => {
      attempts++;
      try {
        this.videoIframe.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: "microreel" }),
          "*"
        );
      } catch {
        // iframe not ready yet
      }
      if (attempts > 20) {
        this.stopListeningHandshake();
      }
    }, 250);
  }

  private stopListeningHandshake(): void {
    if (this.listeningInterval !== null) {
      window.clearInterval(this.listeningInterval);
      this.listeningInterval = null;
    }
  }

  mount(): void {
    if (!document.body.contains(this.host)) {
      document.body.appendChild(this.host);
    }
    void this.loadGeometry();
  }

  unmount(): void {
    this.stopListeningHandshake();
    window.removeEventListener("message", this.messageHandler);
    this.host.remove();
  }

  /** Only respected if the user hasn't manually moved the overlay. */
  setPosition(position: OverlayPosition): void {
    if (this.hasMoved) return;
    this.wrap.classList.toggle("side-right", position === "side-right");
  }

  /** Start buffering a video while it is still hidden, so showVideo is instant. */
  preloadVideo(video: VideoCard): void {
    if (this.preloadedVideoId === video.youtubeId) return; // already loaded
    this.preloadedVideoId = video.youtubeId;
    // autoplay=0 buffers without playing; muted avoids autoplay policy issues
    this.videoIframe.src = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=0&mute=1&controls=1&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
  }

  show(card: MicroCard): void {
    this.hideVideo();
    const title = this.shadowRoot.querySelector(".card .title");
    const body = this.shadowRoot.querySelector(".card .body");
    const cta = this.shadowRoot.querySelector(".card .cta");

    if (!title || !body || !cta) {
      return;
    }

    title.textContent = card.title;
    body.textContent = card.body;
    cta.textContent = card.cta ?? "";

    this.cardEl.classList.add("visible");
    this.wrap.classList.add("has-content");
  }

  private triggerEnded(): void {
    if (this.endingGuard) {
      return;
    }
    this.endingGuard = true;
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    const cb = this.onVideoEndedCallback;
    this.onVideoEndedCallback = null;
    cb?.();
    // Allow future end events after the callback finishes
    queueMicrotask(() => {
      this.endingGuard = false;
    });
  }

  showVideo(video: VideoCard, onEnded?: () => void): void {
    this.hide();
    this.wrap.classList.add("video-active");
    this.onVideoEndedCallback = onEnded ?? null;
    if (this.fallbackTimer !== null) window.clearTimeout(this.fallbackTimer);
    this.fallbackTimer = window.setTimeout(() => {
      this.fallbackTimer = null;
      this.triggerEnded();
    }, video.ttlMs + 2000);
    // Suppress ended events for the first 3s after loading a new video.
    this.videoTransitionUntil = Date.now() + 3000;
    this.endingGuard = false;
    this.clearPlayNudges();

    if (this.preloadedVideoId === video.youtubeId) {
      // Already buffered — unmute and play via postMessage (no src reload needed)
      this.preloadedVideoId = null;
      try {
        this.videoIframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "unMute", args: "" }), "*"
        );
        this.videoIframe.contentWindow?.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: "" }), "*"
        );
      } catch { /* iframe not ready yet, fallback to full load */ }
      // Even with preload, occasionally YouTube sticks on thumbnail; nudge play twice.
      this.playNudgeTimers.push(window.setTimeout(() => this.nudgePlay(), 400));
      this.playNudgeTimers.push(window.setTimeout(() => this.nudgePlay(), 1200));
    } else {
      // No preload match — full load with autoplay
      this.preloadedVideoId = null;
      this.videoIframe.src = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&mute=0&loop=0&playlist=${video.youtubeId}&controls=1&modestbranding=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
      // Nudge play after load in case autoplay is blocked.
      this.playNudgeTimers.push(window.setTimeout(() => this.nudgePlay(), 700));
      this.playNudgeTimers.push(window.setTimeout(() => this.nudgePlay(), 1600));
    }

    this.videoWrap.classList.add("visible");
    this.wrap.classList.add("has-content");
    this.startListeningHandshake();
  }

  hide(): void {
    this.cardEl.classList.remove("visible");
    if (!this.videoWrap.classList.contains("visible")) {
      this.wrap.classList.remove("has-content");
    }
  }

  hideVideo(): void {
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.clearPlayNudges();
    this.stopListeningHandshake();
    this.onVideoEndedCallback = null;
    this.preloadedVideoId = null;
    this.videoWrap.classList.remove("visible");
    this.wrap.classList.remove("video-active");
    if (!this.cardEl.classList.contains("visible")) {
      this.wrap.classList.remove("has-content");
    }
    window.setTimeout(() => { this.videoIframe.src = ""; }, 260);
  }

  hideAll(): void {
    this.hide();
    this.hideVideo();
  }

  private nudgePlay(): void {
    try {
      this.videoIframe.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: "" }),
        "*"
      );
      this.videoIframe.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "unMute", args: "" }),
        "*"
      );
    } catch {
      // iframe not ready yet
    }
  }

  private clearPlayNudges(): void {
    this.playNudgeTimers.forEach((id) => window.clearTimeout(id));
    this.playNudgeTimers = [];
  }

  /** True while the video wrap is visible (playing or fading in). */
  isVideoVisible(): boolean {
    return this.videoWrap.classList.contains("visible");
  }
}
