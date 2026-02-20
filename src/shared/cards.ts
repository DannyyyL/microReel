import { MicroCard } from "./types";

export const cards: MicroCard[] = [
  {
    id: "react-memo",
    title: "React quick win",
    body: "Use memoization only around expensive renders; measure first.",
    cta: "Check component boundaries",
    ttlMs: 12000
  },
  {
    id: "sql-index",
    title: "Database reminder",
    body: "Indexes speed reads but add write cost. Index your real query paths.",
    cta: "Audit top slow queries",
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
  }
];
