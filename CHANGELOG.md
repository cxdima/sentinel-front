# Changelog

All notable changes to the SENTINEL landing page.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/)
and entries are grouped per release or session. No SemVer yet — the site is
pre-1.0.

## [Unreleased]

### Fixed

- **Scroll hang around `how-section` (CRITICAL).** `decodeMonoChildren`
  in `src/utils/scroll.ts` drove a live `TreeWalker` while `decodeText`
  inserted per-character `<span class="char">` nodes; the walker descended
  into each new span, each was a 1-char monospace leaf, and the whole
  thing re-triggered `decodeText` → infinite recursion → page hang in all
  sections from `how-section` onward (they appeared blank because the
  tab was frozen mid-render). Fix snapshots the walker into a plain array
  before mutating and adds a `.char` class guard. See
  `docs/13_landing_page_frontend.md` §3 for the long version.
- **Section-num chip covered panel content.** The `.section-num`
  indicators on `trust-sim` (05 / 08) and `immunity-map` (06 / 08) sat
  directly on top of panel-header status text (`PHASE: THREAT DETECTED`,
  `SIGNATURE PROPAGATING`). Re-styled as a minimal faint top-left label
  with no background — can no longer occlude content.
- **Dev server stale module cache** documented in
  `docs/13_landing_page_frontend.md` §8 — if you see 404s on files you
  just renamed, wipe `node_modules/.vite` and restart Vite.

### Added

- **`<scroll-guide>` component** (`src/components/scroll-guide/`) with:
  - A persistent "keep scrolling" hint, rotated between four copy
    variants, gated on `IDLE_DELAY_MS = 1400 ms` of scroll inactivity
    so it never covers content the user is reading.
  - A back-to-top button that smooth-scrolls to `y = 0`, visible once
    past the first viewport.
  - Both stacked on a right-edge rail so they stay out of the centre
    column, and both honour `prefers-reduced-motion`.
- **Visual-regression + diagnostic scripts** under `scripts/` —
  `shots.mjs`, `idle-shots.mjs`, `diag.mjs`, `inspect.mjs`,
  `log-test.mjs`, `layout.mjs`. See
  `docs/13_landing_page_frontend.md` §7.
- **`docs/13_landing_page_frontend.md`** — frontend maintainer's guide
  covering the scroll model, reveal pipeline, section numbering
  conventions, diagnostic scripts, and historical gotchas.

### Changed

- `.gitignore` now excludes `scripts/_shots/` (screenshot output) and
  common `/tmp-*` scratch files so the repo stays clean.
- Assorted polish on `blur-overlay`, `compare-table`, `feature-card`,
  `hero-section`, `immunity-map`, `marquee-ticker`, `scrolly-section`,
  `timeline-compare`, `trust-sim`, `webgl-bg` accumulated while
  bisecting the scroll hang. Kept where harmless (smaller bundle,
  simpler CSS).

## [0.0.1] — initial commit

- Lit 3 + Vite 6 + TypeScript landing page scaffold.
- Eight scroll-driven sections + hero + CTA + footer.
- WebGL canvas background and scroll-linked blur overlay.
