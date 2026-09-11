// The same graphs as the Node benchmark, measured where the product actually runs.
//
// Node timings say what the algorithms cost. They do not say what a visitor waits for, because the
// expensive part of a graph tool is drawing, and a layout that finishes in a worker still finishes
// in minutes. This opens a folder in Chrome and times each thing separately, including the one
// choice that does not finish: every entity at once under the free layout.
//
//   node scripts/serve.mjs --data /tmp/graph-10000 --port 4300 &
//   node bench/browser.mjs http://127.0.0.1:4300/ ./data/graph-10000 [layout budget seconds]
import { chromium } from "@playwright/test";

const [base, data, budgetSeconds = "180"] = process.argv.slice(2);
if (!base || !data) {
  console.error("usage: node bench/browser.mjs <server url> <?data= value> [layout budget seconds]");
  process.exit(2);
}
const budget = Number(budgetSeconds) * 1000;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ locale: "en-US", viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (event) => errors.push(String(event).slice(0, 200)));

const heap = async () => Math.round((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 1048576);
const say = async (label, from, note = "") =>
  console.log(`${label.padEnd(22)} ${String(Date.now() - from).padStart(7)} ms   heap ${String(await heap()).padStart(4)} MB${note}`);

let t = Date.now();
await page.goto(`${base}?data=${data}`, { waitUntil: "domcontentloaded" });
const health = page.getByRole("tab", { name: /^Health/ });
await health.waitFor({ timeout: 300_000 });
await health.click();
const summary = page.locator(".summary");
await summary.waitFor({ timeout: 300_000 });
await say("load to Health", t);
console.log(`  ${(await summary.innerText()).replace(/\s+/g, " ")}`);

// Communities are half the product, and a plain graph arrives without them.
const find = page.locator(".finding", { hasText: "no communities" }).getByRole("button", { name: "Find communities" });
if (await find.count()) {
  t = Date.now();
  await find.click();
  await summary.getByText(/communities on/).waitFor({ timeout: 600_000 });
  await say("find communities", t);
  console.log(`  ${(await summary.innerText()).replace(/\s+/g, " ")}`);
}

const busy = page.getByText(/Laying out|Computing layout/);
/** Waits for the app's own "still working" line to go away, which is the only honest finish line. */
const settle = async (limit) => {
  // Short: a layout that is going to run says so immediately, and a long poll here would be
  // charged to views that never lay anything out.
  for (let i = 0; i < 8; i += 1) {
    if (await busy.count()) break;
    await page.waitForTimeout(100);
  }
  if (!(await busy.count())) return { label: "", finished: true };
  const label = (await busy.first().innerText().catch(() => "")).replace(/\s+/g, " ");
  try {
    await busy.first().waitFor({ state: "hidden", timeout: limit });
    return { label, finished: true };
  } catch {
    return { label, finished: false };
  }
};

for (const tab of ["Types", "Graph", "Communities", "Quality", "Matrix"]) {
  const target = page.getByRole("tab", { name: tab, exact: true });
  if (!(await target.count()) || (await target.isDisabled())) {
    console.log(`${tab.padEnd(22)} disabled`);
    continue;
  }
  t = Date.now();
  await target.click();
  await page.locator("main canvas, main svg, main table").first().waitFor({ timeout: 300_000 });
  const appeared = Date.now() - t;
  const { finished, label } = await settle(budget);
  await say(`open ${tab}`, t, `   (on screen at ${appeared} ms)${finished ? "" : `   UNFINISHED ("${label}")`}`);
}

// The one choice that does not scale, and the reason the default is not this.
await page.getByRole("tab", { name: "Graph", exact: true }).click();
await page.waitForTimeout(800);
t = Date.now();
await page.locator("label.control", { hasText: "Show" }).locator("select").selectOption("all");
// "free" in the interface is the force arrangement, which is the one that draws every record.
const arrange = page.locator("label.control", { hasText: "Arrange" }).locator("select");
if (await arrange.count()) {
  const values = await arrange.locator("option").evaluateAll((options) => options.map((option) => option.value));
  if (values.includes("force")) await arrange.selectOption("force");
  else console.log(`  (no force arrangement offered; options were ${values.join(", ")})`);
}
const { finished, label } = await settle(budget);
// A worker keeps the page alive while it works; the main thread would not.
let frame = "frozen";
try {
  const ping = Date.now();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))), { timeout: 5000 });
  frame = `${Date.now() - ping} ms to next frame`;
} catch {
  /* left as frozen */
}
await say("every entity, free", t, `   ${finished ? "finished" : `UNFINISHED after ${budget / 1000} s`}   page: ${frame}   ("${label}")`);

console.log(errors.length ? `page errors: ${[...new Set(errors)].join(" | ")}` : "no page errors");
await browser.close();
