#!/usr/bin/env node
// Regenerates the README screenshots and the tour GIF from the sample dataset. Do not edit the
// images by hand: change this script and run it again.
//
//   npm run build && npx vite preview --port 4174 --strictPort &
//   node scripts/capture-readme.mjs            # screenshots + docs/screenshots/ask.gif
//   node scripts/capture-readme.mjs --no-video # screenshots only
//
// Needs Chrome (Playwright's "chrome" channel) and ffmpeg on PATH for the GIF.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.CAPTURE_URL ?? "http://127.0.0.1:4174/";
const out = "docs/screenshots";
const video = !process.argv.includes("--no-video");
const viewport = { width: 1400, height: 900 };

const open = async (page) => {
  await page.goto(base);
  await page.getByRole("button", { name: "Open the sample dataset" }).click();
  await page.getByRole("tab", { name: /^Health/ }).waitFor();
  // The first-visit hint sits above every view; it is not part of what the views show.
  const dismiss = page.getByRole("button", { name: "Dismiss" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
};
const tab = (page, name) => page.getByRole("tab", { name, exact: typeof name === "string" }).first().click();
const top = (locator) => locator.first().evaluate((e) => e.scrollIntoView({ block: "start" }));
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) });

// The whole index with community clouds, rather than the schema the Graph tab opens on.
const graphWhole = async (page) => {
  const selects = page.locator("select");
  await selects.nth(0).selectOption("clouds");
  await selects.nth(1).selectOption("force");
  await selects.nth(2).selectOption("all");
  await page.waitForTimeout(4000);
};

const savedRun = async (page) => {
  await tab(page, "Ask");
  await page.getByRole("button", { name: "See a saved run" }).first().click();
  await page.locator(".answer .cite button").first().waitFor();
};

async function screenshots(browser) {
  const page = await browser.newPage({ locale: "en-US", viewport });
  await open(page);

  await tab(page, /^Health/);
  await page.waitForTimeout(800);
  await shot(page, "health-sample");

  await tab(page, "Types");
  await page.waitForTimeout(1500);
  await shot(page, "schema-sample");

  await tab(page, "Graph");
  await graphWhole(page);
  await shot(page, "network-sample");

  await tab(page, "Communities");
  await page.waitForTimeout(1500);
  await shot(page, "communities-sample");

  await tab(page, "Centrality");
  await page.waitForTimeout(1500);
  await shot(page, "centrality-sample");

  await tab(page, "Shape checks");
  await page.waitForTimeout(800);
  await shot(page, "shapes-sample");

  await tab(page, "Formation");
  await page.waitForTimeout(800);
  const slider = page.locator('input[type="range"]').first();
  await slider.evaluate((e) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(e, e.max);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  await shot(page, "formation-sample");

  await savedRun(page);
  await top(page.locator(".answer"));
  await page.waitForTimeout(800);
  await shot(page, "ask-sample");

  await page.locator(".answer .cite button").nth(1).click();
  await top(page.locator(".graph-pane"));
  await page.waitForTimeout(1500);
  await shot(page, "ask-evidence-sample");
  await page.close();
}

async function tour(browser) {
  const dir = mkdtempSync(join(tmpdir(), "gi-tour-"));
  const context = await browser.newContext({ locale: "en-US", viewport, recordVideo: { dir, size: viewport } });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  await open(page);

  await tab(page, "Types");
  await pause(2200);
  await tab(page, /^Health/);
  await pause(2500);
  await tab(page, "Communities");
  await pause(2500);
  await tab(page, "Graph");
  await pause(1000);
  await graphWhole(page);
  await tab(page, "Centrality");
  await pause(2500);
  await tab(page, "Shape checks");
  await pause(2200);
  await tab(page, "Formation");
  await pause(600);
  await page.getByRole("button", { name: "Play" }).click();
  await pause(4500);

  await savedRun(page);
  await top(page.locator(".answer"));
  await pause(2500);
  await page.locator(".answer .cite button").nth(1).click();
  await pause(600);
  await top(page.locator(".graph-pane"));
  await pause(3500);
  await page.mouse.wheel(0, 500);
  await pause(2000);

  await context.close();
  const webm = readdirSync(dir).find((f) => f.endsWith(".webm"));
  const gif = join(out, "ask.gif");
  // Two passes: a palette from the whole clip, then the GIF with it, so flat UI colours stay flat.
  const scale = "fps=6,scale=860:-1:flags=lanczos";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(dir, webm), "-vf", `${scale},palettegen=max_colors=96:stats_mode=diff`, join(dir, "p.png")]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", join(dir, webm), "-i", join(dir, "p.png"),
    "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`, gif]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`wrote ${gif}`);
}

const browser = await chromium.launch({ channel: "chrome" });
try {
  await screenshots(browser);
  console.log(`wrote screenshots to ${out}/`);
  if (video) await tour(browser);
} finally {
  await browser.close();
}
