import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/** Serve the repo-root `config/` directory at `/config/` so the frontend can
 *  read deployed addresses + scenario config without copying files around. */
const configDir = resolve(__dirname, "..", "config");

export default defineConfig({
    plugins: [
        tailwindcss(),
        {
            name: "sentinel-serve-config",
            configureServer(server) {
                server.middlewares.use("/config", (req, res, next) => {
                    if (!req.url) return next();
                    const path = resolve(configDir, req.url.replace(/^\/+/, "").split("?")[0]);
                    if (!path.startsWith(configDir)) return next(); // no traversal
                    try {
                        const stat = statSync(path);
                        if (!stat.isFile()) return next();
                        res.setHeader("Content-Type", "application/json; charset=utf-8");
                        res.setHeader("Cache-Control", "no-cache");
                        createReadStream(path).pipe(res);
                    } catch {
                        next();
                    }
                });
            },
        },
    ],
    server: {
        port: 3000,
        open: true,
        hmr: true,
    },
});
