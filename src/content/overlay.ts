import { MicroCard, OverlayPosition } from "../shared/types";

export class OverlayRenderer {
  private readonly host: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private readonly cardEl: HTMLDivElement;

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
        top: 20px;
        right: 20px;
        width: 280px;
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
        border-radius: 12px;
        padding: 12px;
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
        font-size: 13px;
        font-weight: 700;
        margin: 0 0 6px;
      }
      .body {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.9);
      }
      .cta {
        margin-top: 8px;
        font-size: 11px;
        opacity: 0.85;
      }
      @media (prefers-reduced-motion: reduce) {
        .card {
          transition: none;
        }
      }
    `;

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    this.cardEl = document.createElement("div");
    this.cardEl.className = "card";
    this.cardEl.innerHTML = '<h4 class="title"></h4><p class="body"></p><div class="cta"></div>';

    wrap.appendChild(this.cardEl);
    this.shadowRoot.append(style, wrap);
  }

  mount(): void {
    if (!document.body.contains(this.host)) {
      document.body.appendChild(this.host);
    }
  }

  unmount(): void {
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
    const title = this.shadowRoot.querySelector(".title");
    const body = this.shadowRoot.querySelector(".body");
    const cta = this.shadowRoot.querySelector(".cta");

    if (!title || !body || !cta) {
      return;
    }

    title.textContent = card.title;
    body.textContent = card.body;
    cta.textContent = card.cta ?? "";

    this.cardEl.classList.add("visible");
  }

  hide(): void {
    this.cardEl.classList.remove("visible");
  }
}
