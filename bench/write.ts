// Writes a synthetic graph to disk, so the browser can be measured on the same shapes the Node
// benchmark uses.
//
//   node bench/write.ts /tmp/graph-50k 50000 0.35
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { synthetic } from "./synthetic.ts";

const [dir, entities, mix] = process.argv.slice(2);
const tables = synthetic({ entities: Number(entities), edgeFactor: 4, mix: Number(mix ?? 0) });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "nodes.csv"), tables.nodes);
writeFileSync(join(dir, "edges.csv"), tables.edges);
console.log(`${dir}: ${tables.nodes.split("\n").length - 1} nodes, ${tables.edges.split("\n").length - 1} edges, ${(tables.bytes / 1024 / 1024).toFixed(1)} MB`);
