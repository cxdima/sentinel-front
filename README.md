# sentinel-front

Frontend for **SENTINEL V2.0** — autonomous on-chain defense with ZK proofs.

## Stack

- [Vite](https://vitejs.dev/) + TypeScript
- [Lit](https://lit.dev/) web components
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Three.js](https://threejs.org/) for visualizations

## Getting started

```bash
npm install
npm run dev
```

Dev server runs at `http://localhost:3000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and produce production build in `dist/` |
| `npm run preview` | Preview the production build locally |

## Project layout

```
src/
├── components/   # Lit web components (one folder per component)
├── styles/       # Global styles and design tokens
├── utils/        # Shared helpers
└── main.ts       # Entry point

public/           # Static assets served at the site root
docs/             # Protocol and design documentation
```

## Documentation

- **Frontend maintainer's guide:** [`docs/13_landing_page_frontend.md`](./docs/13_landing_page_frontend.md)
  — scroll model, reveal pipeline, section conventions, diagnostic scripts,
  historical gotchas. **Read this before touching `src/utils/scroll.ts` or
  the scroll-driven sections.**
- **Changelog:** [`CHANGELOG.md`](./CHANGELOG.md).
- **Protocol and architecture docs:** [`docs/`](./docs), starting with
  [`docs/00_executive_overview.md`](./docs/00_executive_overview.md).

## Diagnostic scripts

`scripts/` contains Playwright-based smoke tests and screenshot harnesses
for the landing page. The most useful one:

```bash
# scroll through all 8 sections, save screenshots to scripts/_shots/
node scripts/shots.mjs
```

See [`docs/13_landing_page_frontend.md`](./docs/13_landing_page_frontend.md) §7
for the full list.
