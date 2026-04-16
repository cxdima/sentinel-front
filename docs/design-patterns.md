# SENTINEL — Design Patterns & Animation System

## 1. Visual Language

### Palette

| Token | Hex | Role |
|---|---|---|
| `--black` | `#000000` | Background — true black, never softened |
| `--surface` | `#0a0a0a` | Panel backgrounds |
| `--surface-alt` | `#111111` | Hover states |
| `--border` | `#1a1a1a` | Structural borders (barely visible) |
| `--border-light` | `#2a2a2a` | Slightly visible borders |
| `--chartreuse` | `#c8ff00` | **Primary accent** — positive states, active, glow |
| `--red` | `#ff2244` | Attack / danger / loss |
| `--amber` | `#d47d27` | Warning / suspicion phase |
| `--green` | `#36c88b` | Proof / validation phase |
| `--white` | `#e8e8e8` | Body text |
| `--white-dim` | `#666666` | Secondary text |
| `--white-muted` | `#444444` | Tertiary / decorative text |

**Rule:** Chartreuse is used ONLY for: active states, correct/good outcomes, accent marks. Red is used ONLY for: attacks, losses, danger. Nothing else gets color — everything is near-black or near-white.

### Typography

| Font | Role | Sizes |
|---|---|---|
| **Bebas Neue** | Display / numbers / headings | `clamp(96px, 18vw, 280px)` hero, `clamp(42px, 5vw, 80px)` section, `24–48px` data values |
| **IBM Plex Mono** | All technical content, labels, body | `13px` body, `10px` labels, `8–9px` micro-labels |

**Rules:**
- Bebas Neue carries visual drama. Use it for anything that needs to fill space aggressively.
- IBM Plex Mono signals "data" and "system". Use it for hashes, coordinates, status labels, all technical strings.
- Letter-spacing: `0.04em` on Bebas Neue, `0.12–0.2em` on Mono labels (ALL CAPS).
- Never mix in a third font family. Contrast comes from weight and size, not typeface variety.

### Grid & Spacing

- Gap between panels: `2px` (creates the "seam" aesthetic)
- Section padding: `48px` sides on desktop, `24px` tablet, `20px` mobile
- Panel internal padding: `16–24px`
- Section headers: `Bebas Neue` display heading + `IBM Plex Mono` code comment beside it

### Reticle Corners

Every panel gets corner brackets via `::before` and `::after`:
```css
.panel::before {
  content: '';
  position: absolute;
  top: -1px; left: -1px;
  width: 14px; height: 14px;
  border-top: 1.5px solid rgba(200,255,0,0.45);
  border-left: 1.5px solid rgba(200,255,0,0.45);
}
.panel::after {
  content: '';
  position: absolute;
  bottom: -1px; right: -1px;
  width: 14px; height: 14px;
  border-bottom: 1.5px solid rgba(200,255,0,0.45);
  border-right: 1.5px solid rgba(200,255,0,0.45);
}
```

### Grid Backgrounds

Interior grid texture on content areas:
```css
background-image:
  linear-gradient(rgba(26,26,26,0.6) 1px, transparent 1px),
  linear-gradient(90deg, rgba(26,26,26,0.6) 1px, transparent 1px);
background-size: 40px 40px;
```

---

## 2. Implemented Animations

### Scanline Sweep
A single hairline moves top-to-bottom on the hero, simulating a radar/monitor refresh.
```css
@keyframes scanline {
  0%   { top: -2px; opacity: 0; }
  5%   { opacity: 1; }
  90%  { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
```
Applied to a `position: absolute; height: 2px; background: linear-gradient(90deg, transparent, #c8ff00, transparent)` element. Loop: 5s.

### Hero Glitch
Chromatic aberration burst on the hero title every ~12s:
```css
@keyframes glitch {
  0%, 90%, 100% { text-shadow: normal; transform: translate(0); }
  91% { text-shadow: -3px 0 rgba(255,34,68,0.7), 3px 0 rgba(0,200,255,0.7); transform: translate(-2px, 1px); }
  92% { text-shadow: 3px 0 rgba(255,34,68,0.7), -3px 0 rgba(0,200,255,0.7); transform: translate(2px,-1px); }
  93% { transform: translate(0); }
  94% { text-shadow: -2px 0 rgba(255,34,68,0.4); transform: translate(-1px, 0); }
}
```

### Fade-Up Reveal (scroll-triggered)
Default entry animation for panels using `IntersectionObserver`:
```css
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1),
              transform 0.6s cubic-bezier(0.16,1,0.3,1);
}
.reveal.in-view { opacity: 1; transform: translateY(0); }
```
Stagger children by adding `transition-delay: 0.15s` increments.

### Hero Stat Counter
`requestAnimationFrame`-driven counter with quartic ease-out:
```js
function animateCount(el, target, duration, format) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = format(Math.round(eased * target));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

### Ticker Marquee
Duplicate content array for seamless loop:
```css
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ticker__track { animation: ticker 35s linear infinite; }
```

### Attack Graph Edge Cycling
SVG `animateMotion` particles travel along edges. JS cycles which edge is "active" (bright) every 2s, the rest stay dim. Active edge: `stroke: #c8ff00; stroke-width: 1.5`. Inactive: `stroke: #2a2a2a; stroke-width: 0.5; stroke-dasharray: 2 4`.

### Immunity Map Pulse Ring
SVG `<animate>` expands a ring from the origin node outward:
```svg
<circle cx="x" cy="y" r="10" fill="none" stroke="#c8ff00" stroke-width="1">
  <animate attributeName="r"       from="10" to="30" dur="1.5s" fill="freeze"/>
  <animate attributeName="opacity" from="0.9" to="0"  dur="1.5s" fill="freeze"/>
</circle>
```

### Battlefield Line Fire
5 vs 5 node grid. Every 3.2s: pick a random RED → BLUE pairing, draw a bright line between them, dim all others. Node boxes flash their background briefly via `.firing` class with `transition: background 0.3s`.

### Trust Collapse Sequence
A 4-phase async sequence driven entirely by `setTimeout` + class additions:
- **Phase 1 (Ambiguity):** Buttons shown. User clicks VERIFY.
- **Phase 2 (Suspicion):** 3 "worst case" lines cascade in at 380ms intervals. 3 check queries cascade in at 340ms intervals.
- **Phase 3 (Proof):** 3 green proof lines scale-in at 220ms intervals.
- **Phase 4 (Resolved):** Full event detail panel fades up.

Phase indicator dot changes color: `#444 → #666 → #d47d27 → #36c88b → #c8ff00`.

---

## 3. The Scroll Blur Overlay (KEY PATTERN)

This is the signature animation. A `position: fixed; bottom: 0` glass panel grows/shrinks as the user scrolls through a designated section. `backdrop-filter: blur(28px)` frosts whatever is behind it in the document flow.

### DOM Structure
```html
<!-- Global — always in DOM, height controlled by JS -->
<div id="blur-overlay">
  <div class="blur-overlay__border"></div>  <!-- chartreuse hairline on top edge -->
  <div class="blur-overlay__inner">
    <div class="blur-phase active" id="phase-0"><!-- content --></div>
    <div class="blur-phase"        id="phase-1"><!-- content --></div>
    <div class="blur-phase"        id="phase-2"><!-- content --></div>
  </div>
</div>

<!-- The trigger section (must be tall — ~380vh) -->
<section id="scrolly-trigger">
  <!-- background visual scrolls normally, gets blurred -->
</section>
```

### CSS
```css
.blur-overlay {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 0;
  z-index: 80;
  overflow: hidden;
  will-change: height;
}
.blur-overlay::before {
  content: '';
  position: absolute; inset: 0;
  backdrop-filter: blur(28px) saturate(0.7);
  background: rgba(4,4,6,0.78);
}
.blur-phase { position: absolute; inset: 0; opacity: 0; transform: translateY(10px); transition: opacity 0.6s, transform 0.6s; }
.blur-phase.active { opacity: 1; transform: translateY(0); }
```

### JS Scroll Driver
```js
function onScroll() {
  const rect     = section.getBoundingClientRect();
  const scrolled = -rect.top;
  const total    = section.offsetHeight - window.innerHeight;
  const progress = Math.max(0, Math.min(1, scrolled / total));

  let heightVh, phaseIdx;
  if (progress < 0.18) {
    heightVh = (progress / 0.18) * 52;  // rise phase
    phaseIdx = 0;
  } else if (progress < 0.4) {
    heightVh = 52;  phaseIdx = 0;       // hold — phase 0
  } else if (progress < 0.58) {
    heightVh = 52;  phaseIdx = 1;       // hold — phase 1
  } else if (progress < 0.75) {
    heightVh = 52;  phaseIdx = 2;       // hold — phase 2
  } else {
    heightVh = 52 - ((progress - 0.75) / 0.25) * 26;  // shrink
    phaseIdx = 2;
  }

  blurOverlay.style.height = heightVh + 'vh';
  // swap active phase
}
window.addEventListener('scroll', onScroll, { passive: true });
```

### Why it works
- `position: fixed` means it never moves with scroll — only its *height* changes.
- The content behind it is the live scrolling document. `backdrop-filter` dynamically blurs whatever is there.
- The top edge (`blur-overlay__border`) gets a chartreuse glow gradient — makes the "arrival" of the pane feel intentional.
- Phases transition with `opacity + translateY` inside the fixed pane, not height changes, so the animation is purely compositor-bound.

---

## 4. Proposed Creative Scroll Patterns

These are the next-level animations to implement. Each is a distinct "scroll module" — a self-contained section with its own trigger logic.

---

### 4.1 Horizontal Slide-In Alternating (Left/Right)

Sections alternate — odd sections enter from the left, even from the right. On scroll progress through each section:

```
Section 1: content slides IN from LEFT  → settles center → slides OUT to RIGHT
Section 2: content slides IN from RIGHT → settles center → slides OUT to LEFT
```

**Implementation:**
- Section height: `200vh` (half for entry, half for exit)
- `position: sticky; height: 100vh` inner container
- Progress 0–50%: `translateX(-100vw → 0)` (entry)
- Progress 50–100%: `translateX(0 → 100vw)` (exit)

```js
const entryT  = Math.max(0, Math.min(1, progress / 0.5));
const exitT   = Math.max(0, Math.min(1, (progress - 0.5) / 0.5));
const dir     = isOdd ? -1 : 1;
const xOffset = entryT < 1
  ? (1 - easeOut(entryT)) * dir * 100   // entering
  : easeIn(exitT) * -dir * 100;          // exiting
content.style.transform = `translateX(${xOffset}vw)`;
```

---

### 4.2 Vertical Split Wipe

The viewport splits in half. The top half scrolls upward, the bottom half scrolls downward, parting like a stage curtain to reveal new content in between.

```
Before:  [    OLD CONTENT     ]
During:  [  OLD (scrolling up)]
         [    NEW CONTENT     ]
         [ OLD (scrolling down)]
After:   [    NEW CONTENT     ]
```

**Implementation:**
- Two `position: fixed; overflow: hidden` panels, top and bottom 50vh each
- Clip with `clip-path: inset(0)` or `overflow: hidden`
- On scroll: top panel `translateY(-progress * 100%)`, bottom panel `translateY(progress * 100%)`
- Snap thresholds at 0% and 100%

```js
const topHalf    = document.getElementById('split-top');
const bottomHalf = document.getElementById('split-bottom');
topHalf.style.transform    = `translateY(${-progress * 100}%)`;
bottomHalf.style.transform = `translateY(${progress * 100}%)`;
```

---

### 4.3 Curtain Wipe with Counter-Direction

A chartreuse band sweeps left-to-right across the full viewport. When it reaches the right edge, the NEW section is behind it. Then the band sweeps right-to-left OFF the viewport, revealing the new section.

This creates a hard editorial "cut" with a flash of color between sections.

```
Progress 0–40%:  chartreuse band moves: left edge → right edge (covers old)
Progress 40–60%: band fully covers viewport (momentary color hold)
Progress 60–100%: left edge of band exits left while right edge follows (unveils new)
```

**CSS:**
```css
.curtain-band {
  position: fixed;
  top: 0; left: -100%; /* starts off-screen left */
  width: 100vw; height: 100vh;
  background: #c8ff00;
  z-index: 200;
  will-change: transform;
}
```

**JS:**
```js
if (progress < 0.4) {
  const t = progress / 0.4;
  band.style.transform = `translateX(${easeInOut(t) * 100}vw)`;
} else if (progress < 0.6) {
  band.style.transform = `translateX(100vw)`; // full coverage
} else {
  const t = (progress - 0.6) / 0.4;
  band.style.transform = `translateX(${100 + easeInOut(t) * 100}vw)`;
}
```

---

### 4.4 Scroll Up, Then Rise From Below

This is the most unusual pattern. A section appears to scroll upward (normal), but when the next section begins, its content **enters from the bottom** while the current section continues scrolling up. Two movements in opposite directions simultaneously.

```
Viewport during transition:
  ┌─────────────────┐
  │ OLD — scrolling  │  ← moves UP at normal scroll speed
  │      UP          │
  ├─────────────────┤
  │ NEW — rising up  │  ← moves UP at 2× speed from below
  └─────────────────┘
```

Both old and new content are "stacked" vertically. The new content just has a much higher upward translation velocity.

**Implementation:** Give the new section's content a `translateY` that starts at `100vh` and reaches `0` when its section's progress is 50%. After that it snaps normally.

```js
// In the "incoming" section:
const offset = Math.max(0, (1 - progress * 2) * 100); // 100vh → 0 in first half
newContent.style.transform = `translateY(${offset}vh)`;
```

---

### 4.5 Scroll-Driven SVG Path Draw

A circuit-board-style SVG path traces across the viewport as you scroll. Nodes along the path light up as the trace reaches them.

**Implementation:** Use `stroke-dasharray` / `stroke-dashoffset` to control draw progress.

```js
const pathLength = path.getTotalLength();
// Initialize
path.style.strokeDasharray  = pathLength;
path.style.strokeDashoffset = pathLength;

// On scroll:
path.style.strokeDashoffset = pathLength * (1 - progress);

// Light up nodes when trace reaches them
nodes.forEach((node, i) => {
  const nodeProgress = (i + 1) / nodes.length;
  node.classList.toggle('lit', progress >= nodeProgress);
});
```

CSS for node "lit" state:
```css
.path-node { fill: #2a2a2a; transition: fill 0.3s, filter 0.3s; }
.path-node.lit { fill: #c8ff00; filter: drop-shadow(0 0 8px #c8ff00); }
```

---

### 4.6 Text Scramble Reveal

Letters randomize rapidly then resolve into the real text. Great for section headings as they scroll into view.

```js
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';

function scramble(el, finalText, duration = 800) {
  const len = finalText.length;
  let frame = 0;
  const totalFrames = Math.round(duration / 16);

  const interval = setInterval(() => {
    el.textContent = finalText.split('').map((char, i) => {
      if (char === ' ') return ' ';
      const resolveAt = Math.floor((i / len) * totalFrames * 0.7);
      if (frame > resolveAt) return char;  // resolved
      return CHARS[Math.floor(Math.random() * CHARS.length)];
    }).join('');
    frame++;
    if (frame >= totalFrames) { el.textContent = finalText; clearInterval(interval); }
  }, 16);
}
```

Trigger on `IntersectionObserver` entry.

---

### 4.7 Magnetic Section Snap (Spring Physics)

Sections have a "magnetic" zone — if the user's scroll momentum would naturally stop inside the zone, it snaps to the nearest section edge with spring animation instead of stopping mid-scroll.

```js
let velocity = 0;
let lastY    = window.scrollY;
let snapping = false;

window.addEventListener('scroll', () => {
  velocity = window.scrollY - lastY;
  lastY = window.scrollY;
}, { passive: true });

// On scroll end (300ms after last scroll event):
function onScrollEnd() {
  if (snapping) return;
  const nearest = findNearestSection();
  const dist    = nearest.top - window.scrollY;

  // Snap only if within 40% of section height
  if (Math.abs(dist) < nearest.height * 0.4 && Math.abs(velocity) < 40) {
    snapping = true;
    springScrollTo(nearest.top, () => { snapping = false; });
  }
}

function springScrollTo(target, onDone) {
  let current = window.scrollY;
  let vel = 0;
  const stiffness = 0.08;
  const damping   = 0.72;

  function frame() {
    const force = (target - current) * stiffness;
    vel = (vel + force) * damping;
    current += vel;
    window.scrollTo(0, current);
    if (Math.abs(vel) > 0.3) requestAnimationFrame(frame);
    else { window.scrollTo(0, target); onDone(); }
  }
  requestAnimationFrame(frame);
}
```

---

### 4.8 Depth Parallax Layers

Each section has 3+ layers at different depth levels. Scroll moves them at different velocities, creating the illusion of 3D depth.

```
Layer 0 (background): moves at 0.2× scroll speed
Layer 1 (midground):  moves at 0.5× scroll speed
Layer 2 (foreground): moves at 1.0× scroll speed (normal)
Layer 3 (text):       moves at 1.0× (text never parallaxes)
```

```js
const PARALLAX_SPEEDS = [0.2, 0.5, 0.8];

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  layers.forEach((layer, i) => {
    const speed = PARALLAX_SPEEDS[i];
    layer.style.transform = `translateY(${scrollY * (1 - speed)}px)`;
  });
}, { passive: true });
```

Combined with `will-change: transform` and keeping layers GPU-composited.

---

### 4.9 Clip-Path Word Reveal

Words are hidden behind a `clip-path: inset(0 100% 0 0)` (right side clipped). Scroll progress opens the clip to `inset(0 0% 0 0)`.

For each word, the reveal start is staggered by word position:

```js
words.forEach((word, i) => {
  const wordStart = i / words.length * 0.7;  // word starts revealing at this progress
  const wordEnd   = wordStart + 0.3;
  const t = Math.max(0, Math.min(1, (progress - wordStart) / (wordEnd - wordStart)));
  const pct = (1 - t) * 100;
  word.style.clipPath = `inset(0 ${pct}% 0 0)`;
});
```

This creates a "typewriter from the side" effect where words stream in left-to-right from a clip reveal.

---

### 4.10 Invert Flash Transition

Between two sections, a brief full-viewport color inversion acts as a camera flash. Pure CSS, ~100ms:

```js
function triggerInvertFlash() {
  document.body.style.filter = 'invert(1)';
  setTimeout(() => { document.body.style.filter = 'none'; }, 100);
}
// Triggered at exact section boundary crossing (progress ≈ 1.0)
```

Or more subtle — just the hero section title:
```css
.hero__title { transition: filter 0ms; }
.hero__title.flash { filter: invert(1) brightness(2); }
```

---

## 5. Animation Performance Rules

1. **Only animate compositor-friendly properties:** `transform`, `opacity`, `clip-path`, `filter`.
2. **Never animate:** `height`, `width`, `top`, `left`, `margin`, `padding`, `border`.
3. **Scroll handlers must be `{ passive: true }`** — never call `preventDefault` in scroll.
4. **Use `will-change: transform`** sparingly, only on elements that *will* transform within the next frame. Remove it after animation ends.
5. **`backdrop-filter` is expensive** — limit to one active instance at a time.
6. **SVG animations via `animateMotion`** are compositor-friendly. Prefer them over JS for continuous particle flows.
7. **Stagger cap:** Maximum 8 staggered children at once. Beyond that, the eye can't track the sequence.

---

## 6. Section Flow Architecture

A complete page should tell a story through its scroll flow. The pattern:

```
SECTION 1: Hero (static, immediate impact)
  → fade-up on stats after 1s delay

SECTION 2: Problem (scroll-blur overlay, 380vh)
  → Phase 0: Stats reveal (rising blur)
  → Phase 1: Why it matters (held blur)
  → Phase 2: The answer (held blur, shrinking)

SECTION 3: How it works (horizontal slide-in, alternating L/R per card)
  → Cards reveal: LEFT | RIGHT | LEFT

SECTION 4: Simulation (static section, user-driven)
  → Trust sequence plays on user click

SECTION 5: Comparison (curtain wipe entry)
  → Chartreuse band sweeps in, table reveals behind it

SECTION 6: Network (path draw + node light-up)
  → SVG circuit trace draws as you scroll

SECTION 7: CTA (magnetic snap)
  → If user scrolls within 40% of CTA, it snaps them the rest of the way
```

Directional consistency:
- **Entering** sections: content comes from the *outside* (left or right or bottom)
- **Exiting** sections: content leaves toward the *inside* (toward center, then out the other side)
- **Never** have two adjacent sections both enter from the same direction

---

## 7. Motion Timing Reference

| Motion type | Duration | Easing |
|---|---|---|
| Micro (hover, dot pulse) | 150–200ms | `ease` |
| Standard (panel reveal) | 300–500ms | `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) |
| Hero entry | 600–800ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Scroll-driven | `0ms` (direct mapping) | JS easing applied to progress value |
| Phase transition (blur) | 600ms | `ease` |
| Spring snap | Physics | stiffness 0.08, damping 0.72 |
| Glitch burst | 400ms total, 4 keyframes | — |
| Path draw | `progress * pathLength` | direct scroll mapping |

Expo-out `cubic-bezier(0.16, 1, 0.3, 1)`: fast start, very slow settle. Best for elements entering the viewport — they arrive confidently and land softly.
