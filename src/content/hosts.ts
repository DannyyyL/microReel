import { HostAdapter } from "../shared/types";

const adapters: HostAdapter[] = [
  {
    name: "chatgpt",
    matches: (hostname) => hostname.includes("chatgpt.com") || hostname.includes("chat.openai.com"),
    inputSelector: "textarea",
    sendButtonSelectors: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]'
    ],
    stopButtonSelectors: [
      'button[data-testid="stop-button"]',
      'button[aria-label*="Stop" i]'
    ],
    typingIndicatorSelectors: ['[data-testid="typing-indicator"]'],
    streamRootSelectors: ['main article', 'main [data-message-author-role="assistant"]']
  },
  {
    name: "claude",
    matches: (hostname) => hostname.includes("claude.ai"),
    inputSelector: "textarea",
    sendButtonSelectors: ['button[aria-label*="Send" i]', 'button[data-testid*="send" i]'],
    stopButtonSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
    typingIndicatorSelectors: ['[data-testid*="typing" i]', '[aria-label*="Typing" i]'],
    streamRootSelectors: ['main', 'section']
  }
];

export function getHostAdapter(): HostAdapter | null {
  const hostname = window.location.hostname;
  return adapters.find((adapter) => adapter.matches(hostname)) ?? null;
}

function hasElement(selectors: string[]): boolean {
  return selectors.some((selector) => document.querySelector(selector));
}

function hasButtonByText(text: string): boolean {
  const lower = text.toLowerCase();
  const buttons = document.querySelectorAll("button");
  for (const button of Array.from(buttons)) {
    const label = (button.getAttribute("aria-label") ?? "").toLowerCase();
    const content = (button.textContent ?? "").toLowerCase();
    if (label.includes(lower) || content.includes(lower)) {
      return true;
    }
  }
  return false;
}

export function detectGenerating(adapter: HostAdapter): boolean {
  if (hasElement(adapter.stopButtonSelectors)) {
    return true;
  }
  if (hasButtonByText("stop generating") || hasButtonByText("stop")) {
    return true;
  }
  return hasElement(adapter.typingIndicatorSelectors);
}
