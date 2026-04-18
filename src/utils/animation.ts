/** Animated counter with quartic ease-out */
export function animateCount(
    el: HTMLElement,
    target: number,
    duration: number,
    format: (v: number) => string = String,
): void {
    const start = performance.now();
    const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = format(Math.round(eased * target));
        if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

const DECODE_CHARS = "▓▒░█▄▀■□▪▫◊◆◇○●ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*<>{}[]~";

function randomChar(set: string): string {
    return set[Math.floor(Math.random() * set.length)];
}

interface CharSpans {
    spans: HTMLSpanElement[];
    resolved: boolean[];
}

/**
 * Build per-character spans inside the element, one span per char.
 * Whitespace characters are preserved as plain text nodes (not animated).
 */
function buildCharSpans(el: HTMLElement, finalText: string): CharSpans {
    el.textContent = "";
    const spans: HTMLSpanElement[] = [];
    const resolved: boolean[] = [];

    for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        if (ch === " " || ch === "\n" || ch === "\t") {
            el.appendChild(document.createTextNode(ch));
            continue;
        }
        const span = document.createElement("span");
        span.className = "char char--scrambling";
        span.textContent = ch;
        el.appendChild(span);
        spans.push(span);
        resolved.push(false);
    }

    return { spans, resolved };
}

/**
 * Decode-style scramble: each char cycles through random glyphs before
 * resolving to the target char. While scrambling, char is green; once
 * resolved, it fades to white. Uses per-character <span> elements.
 */
export function decodeText(el: HTMLElement, duration = 2800, charSet = DECODE_CHARS): void {
    const finalText = el.textContent ?? "";
    if (!finalText.trim()) return;

    const frameInterval = 70;
    const totalFrames = Math.ceil(duration / frameInterval);

    // Map final-text char index (including whitespace) → span index
    const spanIndex: number[] = [];
    let sIdx = 0;
    for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        if (ch === " " || ch === "\n" || ch === "\t") {
            spanIndex.push(-1);
        } else {
            spanIndex.push(sIdx++);
        }
    }

    const { spans, resolved } = buildCharSpans(el, finalText);

    // Pre-compute resolve frame per animated character
    const animatedCount = spans.length;
    const resolveFrames = new Array<number>(animatedCount);
    for (let i = 0; i < animatedCount; i++) {
        const progress = i / Math.max(animatedCount - 1, 1);
        resolveFrames[i] = Math.floor(progress * totalFrames * 0.8) + Math.floor(Math.random() * 6);
    }

    let frame = 0;
    const interval = setInterval(() => {
        for (let i = 0; i < finalText.length; i++) {
            const idx = spanIndex[i];
            if (idx < 0) continue;
            const span = spans[idx];
            if (frame >= resolveFrames[idx]) {
                if (!resolved[idx]) {
                    span.textContent = finalText[i];
                    span.className = "char char--resolved";
                    resolved[idx] = true;
                }
            } else {
                span.textContent = randomChar(charSet);
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
    }, frameInterval);
}

/** Text scramble reveal — same per-character approach, faster frame rate. */
export function scramble(el: HTMLElement, finalText: string, duration = 2400, charSet = DECODE_CHARS): Promise<void> {
    return new Promise((resolve) => {
        const frameRate = 30;
        const totalFrames = Math.round(duration / frameRate);

        const spanIndex: number[] = [];
        let sIdx = 0;
        for (let i = 0; i < finalText.length; i++) {
            const ch = finalText[i];
            if (ch === " " || ch === "\n" || ch === "\t") {
                spanIndex.push(-1);
            } else {
                spanIndex.push(sIdx++);
            }
        }

        const { spans, resolved } = buildCharSpans(el, finalText);
        const animatedCount = spans.length;

        const resolveFrames = new Array<number>(animatedCount);
        for (let i = 0; i < animatedCount; i++) {
            const progress = i / Math.max(animatedCount - 1, 1);
            resolveFrames[i] = Math.floor(progress * totalFrames * 0.65);
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
                    span.textContent = randomChar(charSet);
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
                resolve();
            }
        }, frameRate);
    });
}

/** SVG path draw based on progress 0→1 */
export function drawPath(path: SVGPathElement, progress: number): void {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len * (1 - progress));
}

/** Run callback on first IntersectionObserver entry */
export function onVisible(
    el: HTMLElement,
    callback: () => void,
    options: IntersectionObserverInit = { threshold: 0.1 },
): void {
    const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            callback();
            obs.disconnect();
        }
    }, options);
    obs.observe(el);
}
