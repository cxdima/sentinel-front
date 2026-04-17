# Landing Page — Frontend Maintainer's Guide

This document captures how the marketing landing page is wired together, the
things that have already bitten us, and the workflow for extending or
debugging it. Start here before touching anything under
`src/components/` or `src/utils/scroll.ts`.

## 1. Architecture at a glance

The landing page is a tree of **Lit light-DOM web components** composed by
`landing-page.ts`:

```
<landing-page>
  <webgl-bg>               ← ambient canvas background
  <blur-overlay>           ← radial scroll-linked vignette
  <nav-bar>                ← fixed nav + scroll progress bar
  <hero-section>           ← 01 / 08
  <marquee-ticker>         ← horizontal ticker strip
  <scrolly-section>        ← 01 / 08  — THE PROBLEM (scrollytelling)
  <how-section>            ← 02 / 08  — HOW IT WORKS
  <timeline-compare>       ← 03 / 08  — TIMELINE COMPARE
  <compare-table>          ← 04 / 08  — COMPARISON
  <trust-sim>              ← 05 / 08  — LIVE SIMULATION
  <immunity-map>           ← 06 / 08  — IMMUNITY NETWORK
  <cta-section>            ← 08 / 08  — JOIN THE NETWORK
  <site-footer>
  <scroll-guide>           ← idle scroll hint + back-to-top
</landing-page>
```

Each component:
- Overrides `createRenderRoot()` to render into light DOM (so global CSS and
  `IntersectionObserver` queries work without shadow boundaries).
- Ships its own CSS file next to the TS file (`*.css` imported from `*.ts`).
- Registers itself as a custom element via `@customElement(...)`.

Registration order matters only in that `main.ts` imports every component
file before `landing-page`, which is intentional — don't remove those
imports when tidying, they have side effects.

## 2. Scroll model

The scroll-driven sections (`scrolly-section`, `how-section`,
`timeline-compare`, `compare-table`, `trust-sim`, `immunity-map`) all share
the same shape:

```html
<section class="scrolly-foo">
  <div class="scrolly-foo__sticky">
    <!-- sticky, top: 48px, height: calc(100vh - 48px), flex-centered -->
    <div class="grid / narrative / panel">…</div>
  </div>
  <div class="scrolly-foo__spacer" aria-hidden="true"></div>
  <!-- spacer ~200–300vh tall; drives the scroll budget -->
</section>
```

`scrollProgress(el)` in `src/utils/scroll.ts` maps `-rect.top / (offsetHeight - innerHeight)`
to `[0, 1]`. Components then apply `subRange(p, start, end)` to split that
progress across sub-phases (e.g. reveal card 1 from 0.05–0.25, card 2 from
0.25–0.5, etc.) and write transforms/opacity directly onto cached element
refs — we deliberately do **not** re-render Lit every frame for scroll
effects.

Viewport gating is done with `observeViewport()` so off-screen sections
short-circuit their scroll handlers.

## 3. Reveal / scramble pipeline

`initReveal()` in `src/utils/scroll.ts` is booted from `main.ts`:

1. Walks `.reveal, .reveal-left, .reveal-right, .reveal-scale` and adds an
   `.in-view` class on the first intersection.
2. If the revealed element has a `[data-scramble]` descendant, fires the
   `scrambleReveal()` animation.
3. Calls `decodeMonoChildren(root)` which finds IBM Plex Mono / monospace
   leaf-text elements under the revealed element and scrambles them into
   place via `decodeText()` from `src/utils/animation.ts`.

### ⚠ The TreeWalker recursion trap (already fixed — keep it that way)

`decodeMonoChildren` used to drive a `TreeWalker` while
`decodeText()` mutated the walker's subtree, inserting per-character
`<span class="char">` nodes. The walker descended into those spans, each
one was a 1-char monospace leaf with no `dataset.decoded`, which triggered
`decodeText` again → infinite recursion → page hang around the `how-section`.

Fix (`src/utils/scroll.ts:99`):
- Snapshot the walker into a `candidates: HTMLElement[]` array **before**
  mutating anything.
- Guard with `!el.classList.contains('char')`.

If you ever extend `decodeMonoChildren`, do not re-introduce a live walker.

## 4. Section numbering (`.section-num`)

Each scroll section renders an `aria-hidden` `<span class="section-num">02 / 08</span>`
inside its sticky container. Styling lives in `src/styles/global.css` under
the `SECTION NUMBER INDICATOR` comment.

Why the current rules (tiny, faint, top-left, no background):
- Sticky panels (e.g. `trust-sim`, `immunity-map`) place a `.panel-header`
  with status text (`PHASE: THREAT DETECTED`, `SIGNATURE PROPAGATING`) in
  the top-right of their right column. An opaque chip there covers that
  status.
- A low-opacity text-only label at top-left sits in the outer gutter above
  the narrative eyebrow and can never occlude panel content even if it
  drifts into it.

If you add a new scroll section, keep the `<span class="section-num">`
inside the sticky container at the top of the markup and it will style
correctly.

## 5. `<scroll-guide>` component

`src/components/scroll-guide/` provides the persistent user handholding —
both the "keep scrolling" hint and the back-to-top button. It is a single
fixed-position overlay with `pointer-events: none` on the root and
`pointer-events: auto` only on the button.

Behaviour rules:
- **Hint**: visible only when the user has been idle for
  `IDLE_DELAY_MS = 1400` ms, AND they are past ~35 % of the first viewport,
  AND they are still more than ~35 % of a viewport from the bottom. Hides
  immediately on every scroll event and rescheduled.
- **Back-to-top**: visible once `scrollY > innerHeight * 0.9`. Smooth-scrolls
  to the top on click.
- Both are stacked on a right-edge rail so they never cross the centre
  content column.
- `prefers-reduced-motion` disables the pulsing dot and bobbing chevron.

If you need to suppress the hint in specific sections (e.g. a fullscreen
modal), add a body-level class and extend the `evaluateHint()` check.

## 6. Adding a new scroll-driven section

1. Create `src/components/new-section/new-section.{ts,css}`.
2. Use light DOM + the `scrollProgress` + `subRange` + `observeViewport`
   pattern already shown in `how-section.ts`. Cache element refs in
   `firstUpdated()`; don't re-render on scroll.
3. Give it a `.section-num` span inside its sticky container
   (`NN / 08`, `aria-hidden="true"`).
4. Import it in `src/main.ts` **before** `landing-page` so its custom
   element is defined when `<landing-page>` first renders.
5. Mount it in `landing-page.ts`.

Golden rules:
- Animate transforms / opacity only (compositor-friendly).
- Never animate layout properties (`width`, `top`, `height`…).
- If your section uses monospace leaf text, it will be scrambled on reveal
  — test it. Opt out with a class check inside `decodeMonoChildren` if that
  breaks your design.

## 7. Diagnostic & visual-regression scripts

All under `scripts/` and run against a local dev server
(`npm run dev`, which listens on `http://localhost:3000` or whichever port
Vite picks — the scripts default to `5179`; override with `URL=`).

| Script | Purpose |
| --- | --- |
| `shots.mjs` | 8 checkpoint screenshots — load, each scroll section, and CTA. First-line smoke test. |
| `idle-shots.mjs` | Waits `IDLE_DELAY_MS + ε` at each checkpoint so the scroll hint is visible — use when verifying `scroll-guide` changes. |
| `diag.mjs` | 400-px stepped scroll with heartbeat timeout — isolates exactly where a scroll hang starts. |
| `inspect.mjs` | Prints element counts inside cards; catches infinite-span bugs. |
| `log-test.mjs` | Small-step scroll capturing console output — use when debugging runtime errors that only show up mid-scroll. |
| `layout.mjs` | Dumps `offsetTop` / `offsetHeight` per section — use when checkpoint coordinates drift. |
| `scroll-probe.mjs` / `probe.mjs` / `simple-test.mjs` | Earlier variants, kept for reference. |

Screenshot outputs land in `scripts/_shots/` which is git-ignored.

Common gotcha: **never wait on `networkidle`.** The `webgl-bg` canvas keeps
`requestAnimationFrame` running, which Playwright sees as continuous network
activity. Use `waitUntil: 'domcontentloaded'` plus a short `waitForTimeout`.

## 8. Build / dev hygiene

```
npm run dev      # Vite dev server
npm run build    # tsc && vite build
npm run preview  # preview production build
```

- `npm run build` is the contract for "it compiles". Run it before
  committing.
- Vite's transform cache (`node_modules/.vite`) can occasionally serve
  stale `.js` URLs after big refactors. If you see 404s on files you
  just renamed, stop the dev server, `rm -rf node_modules/.vite`, and
  restart.
- Type errors: `npx tsc --noEmit --pretty false` catches everything the
  build catches without producing output.

## 9. Performance notes

- All scroll handlers use an `rAF` guard (`if (ticking) return`) — never
  add synchronous layout-triggering code to a scroll listener.
- `webgl-bg` is the heaviest component. If you're debugging a performance
  issue, comment it out in `landing-page.ts` first to isolate.
- Keep per-component CSS bundles small; global tokens live in
  `src/styles/global.css`.

## 10. Things we deliberately did **not** do

- No shadow DOM for page components — global styling and reveal observers
  need light DOM.
- No reactive scroll state in Lit (`@state` + re-render per frame is
  expensive). We write to element `.style` directly.
- No networkidle waits in Playwright scripts — see §7.
- No live `TreeWalker` traversal during DOM mutation — see §3.
