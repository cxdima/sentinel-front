import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./nav-bar.css";

@customElement("nav-bar")
export class NavBar extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private scrolled = false;
    @state() private route = "landing";
    @state() private menuOpen = false;
    @state() private scrollProgress = 0;

    private ticking = false;

    private readonly onScroll = () => {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
            const y = window.scrollY;
            const nextScrolled = y > 10;
            if (nextScrolled !== this.scrolled) this.scrolled = nextScrolled;

            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const next = docHeight > 0 ? Math.min(1, y / docHeight) : 0;
            if (Math.abs(next - this.scrollProgress) > 0.002) this.scrollProgress = next;

            this.ticking = false;
        });
    };

    private readonly onHash = () => {
        const h = window.location.hash;
        this.route = h === "#/dashboard" || h === "#/demo" || h === "#/attacker" ? "dashboard" : "landing";
        this.menuOpen = false;
    };

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener("scroll", this.onScroll, { passive: true });
        window.addEventListener("hashchange", this.onHash);
        this.onHash();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("scroll", this.onScroll);
        window.removeEventListener("hashchange", this.onHash);
    }

    private toggleMenu() {
        this.menuOpen = !this.menuOpen;
    }

    private closeMenu() {
        this.menuOpen = false;
    }

    override render() {
        if (this.route === "dashboard") return html``;

        return html`
      <nav
        class="navbar ${this.scrolled ? "navbar--scrolled" : ""} ${this.menuOpen ? "navbar--open" : ""}"
        role="navigation"
        aria-label="Main navigation"
      >
        <div class="navbar__progress" style="transform: scaleX(${this.scrollProgress})" aria-hidden="true"></div>

        <div class="navbar__logo">
          <svg class="navbar__icon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <line x1="11" y1="0"  x2="11" y2="22" stroke="#c8ff00" stroke-width="1" opacity="0.7"/>
            <line x1="0"  y1="11" x2="22" y2="11" stroke="#c8ff00" stroke-width="1" opacity="0.7"/>
            <circle cx="11" cy="11" r="6" fill="none" stroke="#c8ff00" stroke-width="1" opacity="0.5"/>
            <circle cx="11" cy="11" r="2" fill="#c8ff00" opacity="0.9"/>
          </svg>
          <span class="navbar__wordmark">SENTINEL</span>
          <span class="navbar__version">V2.0</span>
        </div>

        <div class="navbar__links">
          <a href="#problem" class="nav-link">THE PROBLEM</a>
          <a href="#how"     class="nav-link">HOW IT WORKS</a>
          <a href="#compare" class="nav-link">COMPARISON</a>
          <a href="#/demo" class="nav-link" @click=${(e: Event) => {
              e.preventDefault();
              window.location.hash = "#/demo";
          }}>LIVE DEMO</a>
        </div>

        <div class="navbar__right">
          <a href="#/dashboard" class="navbar__dashboard-btn" @click=${(e: Event) => {
              e.preventDefault();
              window.location.hash = "#/dashboard";
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="1" y="1" width="5" height="5" stroke="currentColor" stroke-width="1" fill="none"/>
              <rect x="8" y="1" width="5" height="5" stroke="currentColor" stroke-width="1" fill="none"/>
              <rect x="1" y="8" width="5" height="5" stroke="currentColor" stroke-width="1" fill="none"/>
              <rect x="8" y="8" width="5" height="5" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
            WAR ROOM
          </a>

          <button
            class="navbar__hamburger"
            @click=${this.toggleMenu}
            aria-label="${this.menuOpen ? "Close menu" : "Open menu"}"
            aria-expanded="${this.menuOpen}"
          >
            <span class="navbar__hamburger-line navbar__hamburger-line--1"></span>
            <span class="navbar__hamburger-line navbar__hamburger-line--2"></span>
            <span class="navbar__hamburger-line navbar__hamburger-line--3"></span>
          </button>
        </div>
      </nav>

      <!-- Mobile menu overlay -->
      <div class="mobile-menu ${this.menuOpen ? "mobile-menu--open" : ""}" @click=${this.closeMenu}>
        <div class="mobile-menu__panel" @click=${(e: Event) => e.stopPropagation()}>
          <div class="mobile-menu__header">
            <span class="mobile-menu__label">NAVIGATION</span>
            <span class="mobile-menu__code">// SELECT DESTINATION</span>
          </div>
          <div class="mobile-menu__links">
            <a href="#problem" class="mobile-menu__link" @click=${this.closeMenu}>
              <span class="mobile-menu__link-num">01</span>
              <span class="mobile-menu__link-text">THE PROBLEM</span>
            </a>
            <a href="#how" class="mobile-menu__link" @click=${this.closeMenu}>
              <span class="mobile-menu__link-num">02</span>
              <span class="mobile-menu__link-text">HOW IT WORKS</span>
            </a>
            <a href="#compare" class="mobile-menu__link" @click=${this.closeMenu}>
              <span class="mobile-menu__link-num">03</span>
              <span class="mobile-menu__link-text">COMPARISON</span>
            </a>
            <a href="#/demo" class="mobile-menu__link" @click=${(e: Event) => {
                e.preventDefault();
                this.closeMenu();
                window.location.hash = "#/demo";
            }}>
              <span class="mobile-menu__link-num">04</span>
              <span class="mobile-menu__link-text">LIVE DEMO</span>
            </a>
            <a href="#network" class="mobile-menu__link" @click=${this.closeMenu}>
              <span class="mobile-menu__link-num">05</span>
              <span class="mobile-menu__link-text">NETWORK</span>
            </a>
          </div>
          <div class="mobile-menu__footer">
            <a href="#/demo" class="btn btn--primary" style="width:100%;justify-content:center" @click=${(e: Event) => {
                e.preventDefault();
                this.closeMenu();
                window.location.hash = "#/demo";
            }}>
              LAUNCH LIVE DEMO
            </a>
            <a href="#/dashboard" class="btn btn--ghost" style="width:100%;justify-content:center;margin-top:8px" @click=${(
                e: Event,
            ) => {
                e.preventDefault();
                this.closeMenu();
                window.location.hash = "#/dashboard";
            }}>
              VIEW DASHBOARD
            </a>
          </div>
        </div>
      </div>
    `;
    }
}
