import { matchesHost } from "../shared/hosts";
import { HostAdapter } from "../shared/types";

const adapters: HostAdapter[] = [
  {
    name: "chatgpt",
    matches: (hostname, pathname) => matchesHost("chatgpt", hostname, pathname),
    inputSelector: 'textarea, [contenteditable="true"]',
    sendButtonSelectors: [
      'button[data-testid="send-button"]',
      'button[data-testid="composer-send-button"]',
      'button[aria-label*="Send" i]'
    ],
    stopButtonSelectors: [
      'button[data-testid="stop-button"]',
      'button[data-testid="composer-stop-button"]',
      'button[aria-label*="Stop" i]'
    ],
    typingIndicatorSelectors: [
      '[data-testid="typing-indicator"]',
      '.result-streaming',
      '.agent-turn .avatar-container + div'
    ],
    streamRootSelectors: ['main article', 'main [data-message-author-role="assistant"]']
  },
  {
    name: "claude",
    matches: (hostname, pathname) => matchesHost("claude", hostname, pathname),
    inputSelector: "textarea",
    sendButtonSelectors: ['button[aria-label*="Send" i]', 'button[data-testid*="send" i]'],
    stopButtonSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
    typingIndicatorSelectors: ['[data-testid*="typing" i]', '[aria-label*="Typing" i]'],
    streamRootSelectors: ['main', 'section']
  },
  {
    // Google Gemini — gemini.google.com
    name: "gemini",
    matches: (hostname, pathname) => matchesHost("gemini", hostname, pathname),
    inputSelector: 'rich-textarea [contenteditable], .ql-editor',
    sendButtonSelectors: [
      'button.send-button',
      'button[aria-label*="Send" i]',
      'button[mattooltip*="Send" i]'
    ],
    stopButtonSelectors: [
      'button[aria-label*="Stop" i]',
      'button[mattooltip*="Stop" i]'
    ],
    typingIndicatorSelectors: [
      'model-response .loading-indicator',
      '.response-container [aria-busy="true"]',
      'model-response pending-message'
    ],
    streamRootSelectors: ['model-response', '.conversation-container']
  },
  {
    // GitHub Copilot web — github.com/copilot
    name: "copilot",
    matches: (hostname, pathname) => matchesHost("copilot", hostname, pathname),
    inputSelector: [
      'textarea[name="user-message"]',
      'textarea[placeholder*="message" i]',
      'textarea[aria-label*="message" i]',
      'textarea'
    ].join(","),
    sendButtonSelectors: [
      'button[aria-label*="Send" i]',
      'button[aria-label*="Send message" i]',
      'button[data-testid*="send" i]',
      'button[data-testid*="SendButton" i]',
      'button[type="submit"]'
    ],
    stopButtonSelectors: [
      'button[aria-label*="Stop response" i]',
      'button[aria-label*="Stop" i]',
      'button[aria-label*="Stop generating" i]',
      'button[aria-label*="Cancel" i]',
      'button[data-testid*="stop" i]',
      'button[data-testid*="StopButton" i]'
    ],
    typingIndicatorSelectors: [
      '[aria-label*="Copilot is responding" i]',
      '[aria-label*="Generating" i]',
      '[data-testid*="copilot" i] [role="status"]',
      '[data-testid*="copilot" i] [aria-busy="true"]',
      'copilot-chat-messages [aria-busy="true"]',
      '.copilot-loading',
      '.typing-indicator'
    ],
    streamRootSelectors: [
      'copilot-chat-messages',
      '[data-testid*="copilot" i] main',
      '[data-testid*="conversation" i]',
      'main'
    ]
  }
];

export function getHostAdapter(): HostAdapter | null {
  const { hostname, pathname } = window.location;
  return adapters.find((adapter) => adapter.matches(hostname, pathname)) ?? null;
}

function hasElement(selectors: string[]): boolean {
  for (const selector of selectors) {
    try {
      const nodes = document.querySelectorAll(selector);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!(node instanceof HTMLElement)) return true;
        // Fast layout-based visibility check (no getComputedStyle)
        if (node.offsetParent !== null || node.offsetWidth > 0 || node.offsetHeight > 0) {
          return true;
        }
      }
    } catch {
      // invalid selector — skip
    }
  }
  return false;
}

function hasButtonByText(text: string): boolean {
  const lower = text.toLowerCase();
  const buttons = document.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
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
  if (hasButtonByText("stop generating") || hasButtonByText("stop responding")) {
    return true;
  }
  return hasElement(adapter.typingIndicatorSelectors);
}
