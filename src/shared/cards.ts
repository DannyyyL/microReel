import { MicroCard } from "./types";

export const cards: MicroCard[] = [
  {
    id: "react-memo",
    title: "React quick win",
    body: "Use memoization only around expensive renders; measure first.",
    cta: "Check component boundaries",
    hosts: ["chatgpt", "claude", "copilot"],
    ttlMs: 12000
  },
  {
    id: "sql-index",
    title: "Database reminder",
    body: "Indexes speed reads but add write cost. Index your real query paths.",
    cta: "Audit top slow queries",
    hosts: ["chatgpt", "claude", "copilot"],
    ttlMs: 12000
  },
  {
    id: "debug-scope",
    title: "Debug faster",
    body: "Reproduce with the smallest input before changing production code.",
    cta: "Shrink failing case",
    ttlMs: 12000
  },
  {
    id: "math-check",
    title: "Math sanity",
    body: "Estimate expected magnitude first to catch order-of-scale errors.",
    cta: "Do quick back-of-envelope",
    ttlMs: 12000
  },
  {
    id: "prompt-constraints",
    title: "Prompt precision",
    body: "State inputs, constraints, and desired output format up front.",
    cta: "Add acceptance criteria",
    hosts: ["chatgpt", "claude", "gemini", "copilot"],
    maxElapsedMs: 20000,
    ttlMs: 12000
  },
  {
    id: "small-commits",
    title: "Safer iteration",
    body: "Keep changes small and verifiable so regressions are easier to spot.",
    cta: "Ship in narrow slices",
    hosts: ["copilot", "chatgpt"],
    ttlMs: 12000
  },
  {
    id: "test-first-bug",
    title: "Bugfix discipline",
    body: "Capture the failing case in a test before changing behavior.",
    cta: "Lock in the repro",
    hosts: ["copilot", "claude"],
    ttlMs: 12000
  },
  {
    id: "api-contract",
    title: "API stability",
    body: "Prefer additive API changes; avoid silent shape changes in responses.",
    cta: "Version breaking changes",
    hosts: ["chatgpt", "claude", "gemini"],
    ttlMs: 12000
  },
  {
    id: "latency-budget",
    title: "Latency budget",
    body: "Measure p95 before and after optimization to avoid placebo wins.",
    cta: "Track one key metric",
    hosts: ["copilot", "gemini"],
    minElapsedMs: 15000,
    ttlMs: 12000
  },
  {
    id: "review-checklist",
    title: "Review checklist",
    body: "Check behavior, edge cases, and tests before style-level nits.",
    cta: "Prioritize correctness",
    hosts: ["chatgpt", "claude", "copilot"],
    minElapsedMs: 10000,
    ttlMs: 12000
  },
  {
    id: "naming-clarity",
    title: "Naming clarity",
    body: "Prefer concrete names that describe state, not implementation detail.",
    cta: "Rename ambiguous vars",
    ttlMs: 12000
  },
  {
    id: "gemini-grounding",
    title: "Ground your claim",
    body: "When summarizing sources, cite concrete evidence for each conclusion.",
    cta: "Link claim to source",
    hosts: ["gemini"],
    ttlMs: 12000
  },
  {
    id: "claude-reasoning",
    title: "Reasoning hygiene",
    body: "Separate assumptions from facts to make revisions faster.",
    cta: "Label assumptions",
    hosts: ["claude"],
    ttlMs: 12000
  },
  {
    id: "chatgpt-iteration",
    title: "Iteration loop",
    body: "Ask for one concrete revision at a time to improve output quality.",
    cta: "Specify one next change",
    hosts: ["chatgpt"],
    maxElapsedMs: 25000,
    ttlMs: 12000
  },
  {
    id: "copilot-scope",
    title: "Coding scope",
    body: "Constrain file scope before generation to reduce unrelated edits.",
    cta: "Name target files first",
    hosts: ["copilot"],
    ttlMs: 12000
  }
];
