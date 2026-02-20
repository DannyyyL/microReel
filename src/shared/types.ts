export type HostName = "chatgpt" | "claude";

export type OverlayPosition = "top-right" | "side-right";

export interface MicroCard {
  id: string;
  title: string;
  body: string;
  cta?: string;
  ttlMs: number;
}

export interface MicroReelSettings {
  enabled: boolean;
  position: OverlayPosition;
  startDelayMs: number;
  rotationMs: number;
}

export interface EngineInput {
  host: HostName;
  promptText?: string;
  elapsedMs: number;
}

export interface HostAdapter {
  name: HostName;
  matches(hostname: string): boolean;
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
