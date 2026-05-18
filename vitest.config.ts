import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: { "~": new URL("./src", import.meta.url).pathname },
  },
});
