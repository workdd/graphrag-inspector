/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Measurements, not tests: they assert nothing and they are slow, so they stay out of `npm test`.
export default defineConfig({
  test: {
    include: ["bench/**/*.bench.ts"],
    environment: "node",
    testTimeout: 0,
    pool: "forks",
    // The table is the whole point of the run, so it goes straight to the terminal.
    disableConsoleIntercept: true,
  },
});
