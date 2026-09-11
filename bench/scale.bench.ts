// What happens above the size the README quotes.
//
// Every number in the README about size came from one synthetic index, and nothing above it had
// been measured. Worse, the browser now computes communities for a graph that arrived without any,
// and that run is Leiden on the main thread: if it takes thirty seconds at fifty thousand nodes,
// the button that starts it is a trap rather than a feature. This measures each stage separately,
// so a ceiling can be reported as "reading is fine, clustering is not" rather than as one number.
//
//   npm run bench            # the default ladder
//   BENCH_SIZES=100000 npm run bench
import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { synthetic } from "./synthetic";
import { buildCsvDataset } from "../src/core/loaders/csvDataset";
import { derivePartition } from "../src/core/community/derive";
import { levelQuality } from "../src/core/metrics/quality";
import { diagnose } from "../src/core/metrics/diagnosis";
import { parseCsv } from "../src/core/loaders/csv";

const SIZES = (process.env.BENCH_SIZES ?? "1000,5000,10000,25000,50000").split(",").map(Number);
const EDGE_FACTOR = Number(process.env.BENCH_EDGE_FACTOR ?? 4);
/** How much of the graph ignores its own clusters. A third is the realistic case. */
const MIX = Number(process.env.BENCH_MIX ?? 0.35);

const ms = (from: number): number => Math.round(performance.now() - from);
const mb = (): number => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

interface Row {
  entities: number;
  relationships: number;
  csvMb: number;
  parse: number;
  build: number;
  leiden: number;
  quality: number;
  diagnose: number;
  total: number;
  heapMb: number;
  levels: number;
  communities: number;
  modularity: number;
}

const measure = (entities: number): Row => {
  const tables = synthetic({ entities, edgeFactor: EDGE_FACTOR, mix: MIX });

  // Reading the tables, which is what a browser does before anything is on screen.
  let at = performance.now();
  parseCsv(tables.nodes);
  parseCsv(tables.edges);
  const parse = ms(at);

  at = performance.now();
  const { dataset } = buildCsvDataset({ nodes: tables.nodes, edges: tables.edges });
  const build = ms(at);

  // The expensive one, and the one on the main thread.
  at = performance.now();
  const partition = derivePartition(dataset, { seed: 1 });
  const leiden = ms(at);

  at = performance.now();
  const levels = levelQuality(dataset, partition);
  const quality = ms(at);

  at = performance.now();
  diagnose({ dataset, partition, levels, hasEmbeddings: false });
  const diagnosed = ms(at);

  return {
    entities: dataset.entities.size,
    relationships: dataset.relationships.length,
    csvMb: Math.round((tables.bytes / 1024 / 1024) * 10) / 10,
    parse,
    build,
    leiden,
    quality,
    diagnose: diagnosed,
    total: parse + build + leiden + quality + diagnosed,
    heapMb: mb(),
    levels: partition.levels.length,
    communities: partition.communities.size,
    modularity: Math.round((partition.computed?.modularity ?? 0) * 100) / 100,
  };
};

describe("the ceiling", () => {
  it("measures each stage as the graph grows", { timeout: 0 }, () => {
      const rows: Row[] = [];
      for (const size of SIZES) {
        rows.push(measure(size));
        // The next size starts from a clean heap where the runtime allows it, so the memory column
        // reads as "this size needs this much" rather than as a running total.
        global.gc?.();
      }

      const head = ["entities", "rels", "CSV MB", "parse", "build", "leiden", "quality", "diag", "total", "heap MB", "levels", "communities", "Q"];
      const table = rows.map((r) => [
        r.entities.toLocaleString("en-US"),
        r.relationships.toLocaleString("en-US"),
        `${r.csvMb}`,
        `${r.parse} ms`,
        `${r.build} ms`,
        `${r.leiden} ms`,
        `${r.quality} ms`,
        `${r.diagnose} ms`,
        `${r.total} ms`,
        `${r.heapMb}`,
        `${r.levels}`,
        `${r.communities.toLocaleString("en-US")}`,
        `${r.modularity}`,
      ]);
      const width = head.map((h, i) => Math.max(h.length, ...table.map((row) => row[i].length)));
      const line = (cells: string[]) => `| ${cells.map((c, i) => c.padStart(width[i])).join(" | ")} |`;
      const out = [
        `edge factor ${EDGE_FACTOR}, mix ${MIX}, one run per size, node ${process.version}`,
        "",
        line(head),
        `|${width.map((w) => "-".repeat(w + 2)).join("|")}|`,
        ...table.map(line),
      ].join("\n");
      process.stdout.write(`\n${out}\n\n`);
      // Kept as a file so a claim about size can be traced to the run that produced it.
      writeFileSync("bench/results.md", ["# Measured ceiling", "", "Regenerate with `npm run bench`.", "", out, ""].join("\n"));
  });
});
