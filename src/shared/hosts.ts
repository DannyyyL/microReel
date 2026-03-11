import { HostName } from "./types";

export interface SupportedHost {
  id: HostName;
  label: string;
  description: string;
}

export const supportedHosts: SupportedHost[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    description: "chatgpt.com and chat.openai.com"
  },
  {
    id: "claude",
    label: "Claude",
    description: "claude.ai conversations"
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "gemini.google.com chats"
  },
  {
    id: "copilot",
    label: "GitHub Copilot",
    description: "github.com/copilot"
  }
];

const hostLabels = supportedHosts.reduce<Record<HostName, string>>((labels, host) => {
  labels[host.id] = host.label;
  return labels;
}, {} as Record<HostName, string>);

export function getHostLabel(host: HostName): string {
  return hostLabels[host];
}

export function matchesHost(host: HostName, hostname: string, pathname = "/"): boolean {
  switch (host) {
    case "chatgpt":
      return hostname.includes("chatgpt.com") || hostname.includes("chat.openai.com");
    case "claude":
      return hostname.includes("claude.ai");
    case "gemini":
      return hostname.includes("gemini.google.com");
    case "copilot":
      return hostname.includes("github.com") && pathname.startsWith("/copilot");
    default:
      return false;
  }
}

export function getHostNameFromParts(hostname: string, pathname = "/"): HostName | null {
  for (const host of supportedHosts) {
    if (matchesHost(host.id, hostname, pathname)) {
      return host.id;
    }
  }
  return null;
}

export function getHostNameFromUrl(url: string): HostName | null {
  try {
    const { hostname, pathname } = new URL(url);
    return getHostNameFromParts(hostname, pathname);
  } catch {
    return null;
  }
}
