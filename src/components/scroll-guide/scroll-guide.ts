import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./scroll-guide.css";

const HINT_MESSAGES = ["SCROLL TO CONTINUE", "KEEP SCROLLING", "MORE BELOW", "SCROLL DOWN"];
const HINT_ROTATE_MS = 4200;
const IDLE_DELAY_MS = 1400;

@customElement("scroll-guide")
export class ScrollGuide extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private hintVisible = false;
    @state() private topVisible = false;
    @state() private hintIndex = 0;

    private ticking = false;
    private rotateTimer: number | null = null;
    private idleTimer: number | null = null;

    private readonly onScroll = () => {
        // User is actively scrolling — hide the hint immediately so it doesn't
        // sit on top of content they're reading. Schedule a re-show after idle.
        if (this.hintVisible) this.hintVisible = false;
        if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
        this.idleTimer = window.setTimeout(() => this.evaluateHint(), IDLE_DELAY_MS) as unknown as number;

        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            this.ticking = false;
            this.updateTopVisibility();
        });
    };

    private updateTopVisibility() {
        const y = window.scrollY;
        const vh = window.innerHeight;
        this.topVisible = y > vh * 0.9;
    }

    private evaluateHint() {
        const y = window.scrollY;
        const vh = window.innerHeight;
        const docH = document.documentElement.scrollHeight;
        const remaining = docH - (y + vh);
        const pastHero = y > vh * 0.35;
        const nearBottom = remaining < vh * 0.35;
        this.hintVisible = pastHero && !nearBottom;
    }

    private scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    override connectedCallback(): void {
        super.connectedCallback();
        window.addEventListener("scroll", this.onScroll, { passive: true });
        window.addEventListener("resize", this.onScroll, { passive: true });
        this.rotateTimer = window.setInterval(() => {
            this.hintIndex = (this.hintIndex + 1) % HINT_MESSAGES.length;
        }, HINT_ROTATE_MS) as unknown as number;
        // Initial visibility check after mount
        window.setTimeout(() => {
            this.updateTopVisibility();
            this.evaluateHint();
        }, 600);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener("scroll", this.onScroll);
        window.removeEventListener("resize", this.onScroll);
        if (this.rotateTimer !== null) window.clearInterval(this.rotateTimer);
        if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
        this.rotateTimer = null;
        this.idleTimer = null;
    }

    override render() {
        return html`
      <div class="scroll-guide" aria-hidden="true">
        <div class="scroll-guide__rail">
          <div
            class="scroll-guide__hint ${this.hintVisible ? "scroll-guide__hint--visible" : ""}"
          >
            <span class="scroll-guide__hint-dot"></span>
            <span>${HINT_MESSAGES[this.hintIndex]}</span>
            <span class="scroll-guide__hint-chevron">
              <span>▾</span>
              <span>▾</span>
            </span>
          </div>

          <button
            type="button"
            class="scroll-guide__top ${this.topVisible ? "scroll-guide__top--visible" : ""}"
            aria-label="Back to top"
            title="Back to top"
            @click=${this.scrollToTop}
            ?disabled=${!this.topVisible}
            tabindex=${this.topVisible ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 19V5"/>
              <path d="M5 12l7-7 7 7"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    }
}
