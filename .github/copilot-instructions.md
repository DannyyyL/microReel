# MicroReel Product Instructions

These instructions define product behavior for this repository. Treat them as default requirements unless the user explicitly asks to change them.

## Product intent

MicroReel is a browser extension that shows short-form content while an AI assistant is generating. The product should feel lightweight, predictable, and non-disruptive.

## Core product rules

- Prioritize user-visible behavior over internal refactors.
- Preserve the current product promise: MicroReel appears during generation and gets out of the way cleanly.
- Do not change product behavior silently. If a requested code change would alter user-facing behavior, keep the existing behavior unless the user asked for that change.

## Video playback rules

- In entertainment mode, a playing YouTube Short must be allowed to finish before the overlay closes.
- In entertainment mode, a new video must not start just because a prompt finished. A new video should only begin after the current video ends and only if generation is still active, whether that be from the current prompt or a new one.
- If generation stops while a video is playing, let the current video finish, then close the overlay.
- If generation is still active when a video ends, the next video may be selected and played.
- Do not interrupt or replace an in-progress video unless the user explicitly requests that behavior.

## Overlay behavior rules

- The overlay should appear and disappear predictably.
- Autohide behavior should feel immediate from the user perspective.
- Avoid visual hacks that noticeably degrade the viewing experience unless there is no other viable option and the user accepts the tradeoff.
- Do not close the overlay early while content that is supposed to finish is still in progress.

## Settings and UX rules

- Settings should reflect actual product behavior.
- If a setting label or description no longer matches implementation, update the UX so the user is not misled.
- Prefer product clarity over adding more controls.

## Change approach

- When making changes, prefer minimal edits that preserve established product behavior.
- Validate behavior changes with `npm run build` and `npm test` when relevant.
- If a request conflicts with these rules, follow the user's request for that task, but do not treat the exception as the new default.