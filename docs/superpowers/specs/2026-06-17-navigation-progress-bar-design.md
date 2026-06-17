# Navigation Progress Bar — Design

_Date: 2026-06-17_

Give visible feedback on page navigation so a click never looks like "nothing happened"
while the next (server-rendered) page loads.

## Approach
Add **`nextjs-toploader`** and mount it once in the root layout. It hooks into all App Router
navigations — header nav links, the "Make your picks" CTA, any `<Link>`, and programmatic
`router.push` — and slides a thin bar across the top of the viewport during the transition,
completing when the new page renders. No per-page changes.

## Implementation
- **Dependency:** `nextjs-toploader`.
- **`src/app/layout.tsx`:** import `NextTopLoader` and render it as the first child of `<body>`:
  ```tsx
  <NextTopLoader
    color="#ffcb3d"
    height={3}
    showSpinner={false}
    shadow="0 0 10px #ffcb3d,0 0 5px #ffcb3d"
    zIndex={1600}
  />
  ```
- **Color** `#ffcb3d` = theme `accent`/`gold` (`tailwind.config.ts`); pops on the dark-green header.
- **3px** tall, soft gold glow; **`zIndex 1600`** sits above the sticky header (`z-50`).
- **`showSpinner={false}`** — the bar alone is the indicator (no corner spinner).
- It's a client component mounted in the server layout (supported by Next).

## Scope / non-goals
- Covers **route transitions** only. In-place server-action submits (save picks, save
  tiebreaker, login, password/username changes) already show their own pending states
  ("Saving…", disabled buttons) and are out of scope.
- No schema/env changes.

## Testing
- Nothing to unit-test (a library mount). Verified manually: click a nav link / the picks CTA
  and confirm the gold bar animates across the top and completes on the new page; `npm run
  build` succeeds.

## Rollout
- `npm install nextjs-toploader`; build green; deploy = `git push origin master`.
- Update `handoff.md` (layout note).
