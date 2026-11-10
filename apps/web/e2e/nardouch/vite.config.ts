import { defineConfig } from "vite";
import path from "node:path";
const web = path.resolve(import.meta.dirname, "../..");
export default defineConfig({
  root: import.meta.dirname,
  publicDir: path.join(web, "public"),
  resolve: {
    alias: {
      "@": path.join(web, "src"),
      "@noveris/shared": path.resolve(web, "../api/shared"),
    },
  },
  esbuild: { jsx: "automatic" },
  plugins: [
    {
      name: "test-only-action-transport",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          source === "./actions" &&
          importer?.includes("/src/features/nardouch/")
        )
          return path.join(import.meta.dirname, "actions.fixture.ts");
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4179,
    strictPort: true,
    fs: { allow: [web, path.resolve(web, "../api/shared")] },
  },
});
