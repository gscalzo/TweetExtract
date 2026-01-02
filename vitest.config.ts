import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/.pnpm-store/**", "**/node_modules/**", "**/dist/**"],
  },
});
