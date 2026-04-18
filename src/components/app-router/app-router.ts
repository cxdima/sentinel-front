import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

type Route = "landing" | "dashboard" | "demo" | "attacker";

@customElement("app-router")
export class AppRouter extends LitElement {
    override createRenderRoot() {
        return this;
    }

    @state() private route: Route = "landing";

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener("hashchange", this.onHash);
        this.onHash();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("hashchange", this.onHash);
    }

    private readonly onHash = () => {
        const hash = window.location.hash;
        let newRoute: Route = "landing";
        if (hash === "#/dashboard") newRoute = "dashboard";
        else if (hash === "#/demo") newRoute = "demo";
        else if (hash === "#/attacker") newRoute = "attacker";
        if (newRoute !== this.route) {
            this.route = newRoute;
            window.scrollTo(0, 0);
        }
        document.body.classList.toggle("in-app", newRoute !== "landing");
    };

    override render() {
        if (this.route === "dashboard") {
            return html`<war-room></war-room>`;
        }
        if (this.route === "demo") {
            return html`<war-demo-room></war-demo-room>`;
        }
        if (this.route === "attacker") {
            return html`<attacker-brief></attacker-brief>`;
        }
        return html`<landing-page></landing-page>`;
    }
}
