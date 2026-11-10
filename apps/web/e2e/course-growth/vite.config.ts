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
      "next/image": path.join(import.meta.dirname, "image.fixture.tsx"),
      "next/link": path.join(import.meta.dirname, "link.fixture.tsx"),
    },
  },
  esbuild: { jsx: "automatic" },
  plugins: [
    {
      name: "test-only-growth-action-transport",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          source === "./course-growth-actions" &&
          importer?.includes("/src/features/nardouch/")
        )
          return path.join(import.meta.dirname, "actions.fixture.ts");
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4181,
    strictPort: true,
    fs: { allow: [web, path.resolve(web, "../api/shared")] },
  },
});
