import { defineConfig } from "vite";

// Custom plugin to enforce headers on all dev server responses
const crossOriginIsolationPlugin = () => ({
  name: "configure-response-headers",
  configureServer: (server: any) => {
    server.middlewares.use((_req: any, res: any, next: any) => {
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    });
  },
});

export default defineConfig({
  plugins: [
    crossOriginIsolationPlugin()
  ]
});