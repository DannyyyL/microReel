export type HostName = "chatgpt" | "claude" | "gemini" | "copilot";

export type OverlayPosition = "top-right" | "side-right";

export type ContentMode = "education" | "entertainment";

export interface MicroCard {
  id: string;
  title: string;
  body: string;
  cta?: string;
  ttlMs: number;
}

export interface VideoCard {
  id: string;
  title: string;
  /** YouTube video ID (works for Shorts too) */
  youtubeId: string;
  ttlMs: number;
}

export interface MicroReelSettings {
  enabled: boolean;
  mode: ContentMode;
  position: OverlayPosition;
  startDelayMs: number;
  rotationMs: number;
  stopOnHostDone: boolean;
}

export interface EngineInput {
  host: HostName;
  promptText?: string;
  elapsedMs: number;
}

export interface HostAdapter {
  name: HostName;
  /** Return true if this adapter should handle the current page. */
  matches(hostname: string, pathname: string): boolean;
  inputSelector: string;
  sendButtonSelectors: string[];
  stopButtonSelectors: string[];
  typingIndicatorSelectors: string[];
  streamRootSelectors: string[];
}

export interface SessionEvent {
  type: "submitted" | "generating-start" | "generating-stop";
  host: HostName;
  url: string;
  timestamp: number;
}
