import { decodeText } from "./animation";

/** Linear scroll progress through an element: 0 at top, 1 at bottom */
export function scrollProgress(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const scrolled = -rect.top;
    const total = el.offsetHeight - window.innerHeight;
    return Math.max(0, Math.min(1, scrolled / total));
}

/** Map a progress value through a sub-range, outputs 0→1 */
export function subRange(p: number, start: number, end: number): number {
    return Math.max(0, Math.min(1, (p - start) / (end - start)));
}

/** Returns true if an element's bounding rect overlaps the viewport with a buffer. */
export function isNearViewport(el: HTMLElement, buffer = 200): boolean {
    const rect = el.getBoundingClientRect();
    return rect.bottom > -buffer && rect.top < window.innerHeight + buffer;
}

/**
 * Watches an element's viewport visibility and fires callback on change.
 * Returns a disposer that disconnects the observer.
 */
export function observeViewport(
    el: Element,
    onChange: (inView: boolean) => void,
    rootMargin = "400px 0px 400px 0px",
): () => void {
    const obs = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) onChange(entry.isIntersecting);
        },
        { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
}

export const ease = {
    inOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
};

/** Spring snap-scroll to a target Y position */
export function springScrollTo(target: number, onDone?: () => void): void {
    let current = window.scrollY;
    let vel = 0;
    const stiffness = 0.08;
    const damping = 0.72;

    function frame() {
        const force = (target - current) * stiffness;
        vel = (vel + force) * damping;
        current += vel;
        window.scrollTo(0, current);
        if (Math.abs(vel) > 0.3) {
            requestAnimationFrame(frame);
        } else {
            window.scrollTo(0, target);
            onDone?.();
        }
    }
    requestAnimationFrame(frame);
}

/** Wire IntersectionObserver scroll-reveal for .reveal elements */
export function initReveal(): void {
    const obs = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("in-view");

                    // Trigger text scramble on data-scramble elements
                    const scrambleEl = entry.target.querySelector<HTMLElement>("[data-scramble]");
                    if (scrambleEl && !scrambleEl.dataset.scrambled) {
                        scrambleEl.dataset.scrambled = "true";
                        const finalText = scrambleEl.dataset.scramble ?? scrambleEl.textContent ?? "";
                        scrambleReveal(scrambleEl, finalText);
                    }

                    // Auto-decode IBM Plex Mono text elements
                    decodeMonoChildren(entry.target as HTMLElement);

                    obs.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale").forEach((el) => obs.observe(el));
}

/** Decode all IBM Plex Mono leaf-text children within a container */
function decodeMonoChildren(container: HTMLElement): void {
    // Skip components that have their own animation logic
    if (container.closest("hero-section") || container.closest("trust-sim")) return;

    // Snapshot the tree before mutating. decodeText replaces an element's
    // text with per-character <span>s; a live walker would then descend
    // into each new span and re-trigger decoding, recursing forever.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    const candidates: HTMLElement[] = [];
    let node: Node | null = walker.currentNode;
    while (node) {
        candidates.push(node as HTMLElement);
        node = walker.nextNode();
    }

    for (const el of candidates) {
        if (
            el.childElementCount === 0 &&
            el.textContent?.trim() &&
            !el.dataset.decoded &&
            !el.dataset.scrambled &&
            !el.classList.contains("char")
        ) {
            const font = getComputedStyle(el).fontFamily.toLowerCase();
            if (font.includes("ibm plex mono") || font.includes("monospace")) {
                el.dataset.decoded = "true";
                decodeText(el, 2800);
            }
        }
    }
}

const SCRAMBLE_CHARS = "▓▒░█▄▀■□ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";

function scrambleReveal(el: HTMLElement, finalText: string, duration = 2000): void {
    // Build per-character spans
    el.textContent = "";
    const spanIndex: number[] = [];
    const spans: HTMLSpanElement[] = [];
    const resolved: boolean[] = [];
    for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        if (ch === " " || ch === "\n" || ch === "\t") {
            el.appendChild(document.createTextNode(ch));
            spanIndex.push(-1);
            continue;
        }
        const span = document.createElement("span");
        span.className = "char char--scrambling";
        span.textContent = ch;
        el.appendChild(span);
        spans.push(span);
        resolved.push(false);
        spanIndex.push(spans.length - 1);
    }

    const animatedCount = spans.length;
    const totalFrames = Math.round(duration / 30);
    const resolveFrames = new Array<number>(animatedCount);
    for (let i = 0; i < animatedCount; i++) {
        const progress = i / Math.max(animatedCount - 1, 1);
        resolveFrames[i] = Math.floor(progress * totalFrames * 0.6);
    }

    let frame = 0;
    const interval = setInterval(() => {
        for (let i = 0; i < finalText.length; i++) {
            const idx = spanIndex[i];
            if (idx < 0) continue;
            const span = spans[idx];
            if (frame > resolveFrames[idx]) {
                if (!resolved[idx]) {
                    span.textContent = finalText[i];
                    span.className = "char char--resolved";
                    resolved[idx] = true;
                }
            } else {
                span.textContent = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
            }
        }

        frame++;
        if (frame >= totalFrames) {
            for (let i = 0; i < finalText.length; i++) {
                const idx = spanIndex[i];
                if (idx < 0) continue;
                spans[idx].textContent = finalText[i];
                spans[idx].className = "char char--resolved";
            }
            clearInterval(interval);
        }
    }, 30);
}
