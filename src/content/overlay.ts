import { MicroCard, OverlayPosition, VideoCard } from "../shared/types";

export class OverlayRenderer {
  private readonly host: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private readonly cardEl: HTMLDivElement;
  private readonly videoWrap: HTMLDivElement;
  private readonly videoIframe: HTMLIFrameElement;
  private onVideoEndedCallback: (() => void) | null = null;
  private fallbackTimer: number | null = null;
  private readonly messageHandler: (event: MessageEvent) => void;

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
        pointer-events: none;
      }
      .wrap.side-right {
        top: 50%;
        transform: translateY(-50%);
      }
      .card {
        background: rgba(17, 24, 39, 0.95);
        color: #ffffff;
        border-radius: 14px;
        padding: 16px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 250ms ease, transform 250ms ease;
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
      .video-wrap {
        border-radius: 14px;
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 250ms ease, transform 250ms ease;
        pointer-events: auto;
        background: #000;
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
      }
      @media (prefers-reduced-motion: reduce) {
        .card, .video-wrap {
          transition: none;
        }
      }
    `;

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    this.cardEl = document.createElement("div");
    this.cardEl.className = "card";
    this.cardEl.innerHTML = '<h4 class="title"></h4><p class="body"></p><div class="cta"></div>';

    this.videoWrap = document.createElement("div");
    this.videoWrap.className = "video-wrap";
    this.videoIframe = document.createElement("iframe");
    this.videoIframe.allow = "autoplay; encrypted-media";
    this.videoIframe.setAttribute("allowfullscreen", "");
    this.videoWrap.append(this.videoIframe);

    wrap.append(this.cardEl, this.videoWrap);
    this.shadowRoot.append(style, wrap);

    this.messageHandler = (event: MessageEvent) => {
      if (!event.origin.includes("youtube.com")) {
        return;
      }
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // YouTube sends two formats depending on how the player was initialized:
        // 1) via JS IFrame API:  { event: "onStateChange", info: 0 }
        // 2) via enablejsapi=1: { event: "infoDelivery", info: { playerState: 0 } }
        const ended =
          (data?.event === "onStateChange" && data?.info === 0) ||
          (data?.event === "infoDelivery" && data?.info?.playerState === 0);
        if (ended) {
          this.triggerEnded();
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", this.messageHandler);
  }

  mount(): void {
    if (!document.body.contains(this.host)) {
      document.body.appendChild(this.host);
    }
  }

  unmount(): void {
    window.removeEventListener("message", this.messageHandler);
    this.host.remove();
  }

  setPosition(position: OverlayPosition): void {
    const wrap = this.shadowRoot.querySelector(".wrap");
    if (!wrap) {
      return;
    }
    wrap.classList.toggle("side-right", position === "side-right");
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
  }

  private triggerEnded(): void {
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    const cb = this.onVideoEndedCallback;
    this.onVideoEndedCallback = null;
    cb?.();
  }

  showVideo(video: VideoCard, onEnded?: () => void): void {
    this.hide();
    this.onVideoEndedCallback = onEnded ?? null;
    // Clear any previous fallback timer
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
    }
    // Fallback: if postMessage never fires, close after ttlMs + 2s buffer
    this.fallbackTimer = window.setTimeout(() => {
      this.fallbackTimer = null;
      this.triggerEnded();
    }, video.ttlMs + 2000);
    this.videoIframe.src = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&mute=0&loop=0&playlist=${video.youtubeId}&controls=1&modestbranding=1&playsinline=1&rel=0&enablejsapi=1`;
    this.videoWrap.classList.add("visible");
  }

  hide(): void {
    this.cardEl.classList.remove("visible");
  }

  hideVideo(): void {
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    this.onVideoEndedCallback = null;
    this.videoWrap.classList.remove("visible");
    window.setTimeout(() => { this.videoIframe.src = ""; }, 260);
  }

  hideAll(): void {
    this.hide();
    this.hideVideo();
  }
}
