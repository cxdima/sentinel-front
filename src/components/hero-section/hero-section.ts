import { LitElement, html, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { animateCount, onVisible, scramble } from "../../utils/animation";
import { observeViewport } from "../../utils/scroll";
import "./hero-section.css";

const GRAPH_NODES = [
    { x: 80, y: 60, label: "ATK", color: "#ff2244" },
    { x: 180, y: 160, label: "LOAN", color: "#d47d27" },
    { x: 320, y: 80, label: "ORACL", color: "#e8e8e8" },
    { x: 440, y: 200, label: "POOL", color: "#36c88b" },
    { x: 560, y: 100, label: "LIQD", color: "#e8e8e8" },
    { x: 280, y: 260, label: "DEX", color: "#e8e8e8" },
    { x: 480, y: 320, label: "VAULT", color: "#36c88b" },
    { x: 140, y: 310, label: "GOVN", color: "#e8e8e8" },
];

const GRAPH_EDGES = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 5],
    [5, 6],
    [3, 6],
    [0, 7],
    [7, 5],
    [2, 4],
    [4, 6],
];

@customElement("hero-section")
export class HeroSection extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private revealed = false;
    @state() private inView = false;

    private statsTimer: ReturnType<typeof setTimeout> | null = null;
    private disposeObserver: (() => void) | null = null;

    override firstUpdated() {
        onVisible(this as unknown as HTMLElement, () => {
            this.revealed = true;

            const subtitleEl = this.querySelector<HTMLElement>(".hero__subtitle");
            if (subtitleEl) {
                scramble(subtitleEl, subtitleEl.dataset.text ?? subtitleEl.textContent ?? "", 3000);
            }

            this.statsTimer = setTimeout(
                () => {
                    this.statsTimer = null;
                    const capitalEl = this.querySelector<HTMLElement>("#stat-capital");
                    const threatsEl = this.querySelector<HTMLElement>("#stat-threats");
                    const responseEl = this.querySelector<HTMLElement>("#stat-response");
                    if (capitalEl) animateCount(capitalEl, 2109, 2000, (v) => `$${(v / 100).toFixed(1)}M`);
                    if (threatsEl) animateCount(threatsEl, 47, 1600, (v) => String(v));
                    if (responseEl) animateCount(responseEl, 340, 1400, (v) => `${v}ms`);
                },
                window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 3300,
            );
        });

        this.disposeObserver = observeViewport(this, (inView) => {
            if (inView !== this.inView) this.inView = inView;
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        if (this.statsTimer !== null) {
            clearTimeout(this.statsTimer);
            this.statsTimer = null;
        }
        this.disposeObserver?.();
        this.disposeObserver = null;
    }

    private renderGraph() {
        const animate = this.inView;
        return svg`
      <svg class="hero__graph-svg" viewBox="0 0 640 380" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" stroke-width="0.3"/>
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="640" height="380" fill="url(#hg-grid)"/>
        ${GRAPH_EDGES.map(([a, b]) => {
            const n1 = GRAPH_NODES[a],
                n2 = GRAPH_NODES[b];
            return svg`
            <line class="hg-edge" x1=${n1.x} y1=${n1.y} x2=${n2.x} y2=${n2.y}/>
          `;
        })}
        ${
            animate
                ? GRAPH_EDGES.map(([a, b], i) => {
                      const n1 = GRAPH_NODES[a],
                          n2 = GRAPH_NODES[b];
                      const isAttack = a === 0 || b === 0;
                      return svg`
            <circle r="2" fill=${isAttack ? "#ff2244" : "#c8ff00"} opacity="0.9">
              <animateMotion
                dur=${1.5 + i * 0.3}s
                repeatCount="indefinite"
                path=${"M" + n1.x + "," + n1.y + " L" + n2.x + "," + n2.y}
                begin=${i * 0.2}s
              />
            </circle>
          `;
                  })
                : ""
        }
        ${GRAPH_NODES.map(
            (n) => svg`
          <g>
            <circle cx=${n.x} cy=${n.y} r="16" fill="none" stroke=${n.color} stroke-width="0.5" opacity="0.2"/>
            <rect x=${n.x - 10} y=${n.y - 10} width="20" height="20"
              fill="#000" stroke=${n.color} stroke-width=${n.color === "#ff2244" ? "1.5" : "0.8"}
              opacity=${n.color === "#ff2244" ? "1" : "0.6"}/>
            <text x=${n.x} y=${n.y + 3.5} text-anchor="middle"
              fill=${n.color} font-size="5" font-family="'IBM Plex Mono',monospace"
              font-weight="600" letter-spacing="0.08em" opacity="0.9">${n.label}</text>
          </g>
        `,
        )}
      </svg>
    `;
    }

    override render() {
        return html`
      <section class="hero ${this.revealed ? "hero--revealed" : ""}" id="hero" aria-labelledby="hero-heading">

        <div class="hero__grid-bg" aria-hidden="true"></div>
        <div class="hero__scanline" aria-hidden="true"></div>

        <div class="hero__bg-graph" aria-hidden="true">
          ${this.renderGraph()}
        </div>

        <div class="hero__gradient-mask" aria-hidden="true"></div>
        <div class="hero__corner hero__corner--tl" aria-hidden="true"></div>
        <div class="hero__corner hero__corner--br" aria-hidden="true"></div>

        <div class="hero__content">
          <div class="hero__eyebrow hero__anim-1">
            <span class="hero__eyebrow-label">ON-CHAIN AUTONOMOUS DEFENSE</span>
          </div>

          <h1 id="hero-heading" class="hero__title hero__anim-2">SENTINEL</h1>

          <p class="hero__subtitle hero__anim-3"
             aria-label="Your protocol's immune system. Detects threats in the mempool, responds in the same block, and cryptographically proves what was prevented."
             aria-live="off"
             data-text="Your protocol's immune system. Detects threats in the mempool, responds in the same block, and cryptographically proves what was prevented.">
            Your protocol's immune system. Detects threats in the mempool, responds in the same block, and cryptographically proves what was prevented.
          </p>

          <div class="hero__ctas hero__anim-4">
            <a href="#problem" class="btn btn--primary btn--lg">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 2 L8 14 M3 9 L8 14 L13 9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              </svg>
              SEE THE PROBLEM
            </a>
            <a href="#/demo" class="btn btn--ghost btn--lg" @click=${(e: Event) => {
                e.preventDefault();
                window.location.hash = "#/demo";
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <polygon points="3,2 13,8 3,14" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
              </svg>
              LIVE DEMO
            </a>
          </div>

          <div class="hero__stats hero__anim-5">
            <div class="hero-stat">
              <div class="hero-stat__value" id="stat-capital">$0</div>
              <div class="hero-stat__label">CAPITAL PROTECTED</div>
            </div>
            <div class="hero-stat__divider"></div>
            <div class="hero-stat">
              <div class="hero-stat__value" id="stat-threats">0</div>
              <div class="hero-stat__label">THREATS NEUTRALIZED</div>
            </div>
            <div class="hero-stat__divider"></div>
            <div class="hero-stat">
              <div class="hero-stat__value" id="stat-response">0ms</div>
              <div class="hero-stat__label">AVG RESPONSE TIME</div>
            </div>
          </div>
        </div>

        <div class="hero__scroll-cue hero__anim-6" aria-hidden="true">
          <div class="hero__scroll-line"></div>
          <span class="hero__scroll-text">SCROLL TO EXPLORE</span>
        </div>
      </section>
    `;
    }
}
