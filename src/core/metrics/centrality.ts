// Who sits where in the graph, by five standard measures, so a reader can see whether a record that
// looks important is an outlier or one of many. Everything runs here in the browser on the loaded
// relationships; nothing is read from the index.
//
// PageRank follows the arrows. The other four read the graph as undirected and simple: a pair of
// records joined by several relationships counts as one link, and a record linked to itself adds
// nothing. That is what "how many others does it reach" means to a reader.
//
// Betweenness (Brandes 2001) and closeness need a breadth-first search from every record. Past
// `exactUpTo` records they are estimated from a fixed sample of sources (Brandes & Pich 2007) and
// say so, because the numbers are then a ranking of the clear leaders rather than exact values.
import type { Dataset } from "../model";

export type MetricKey = "degree" | "pagerank" | "betweenness" | "closeness" | "clustering";
export const METRICS: MetricKey[] = ["pagerank", "betweenness", "degree", "closeness", "clustering"];

export interface Centrality {
  /** Entity ids, in the order every value array follows. */
  ids: string[];
  values: Record<MetricKey, Float64Array>;
  /** Sources the breadth-first searches started from; equals ids.length when exact. */
  pivots: number;
  estimated: boolean;
  /** Distinct undirected links the four undirected measures read. */
  links: number;
}

export interface CentralityOptions {
  /** Above this many records, betweenness and closeness are sampled. */
  exactUpTo?: number;
  /** Sources sampled when estimating. */
  pivots?: number;
  /** Fixed so the same index gives the same estimate on every load. */
  seed?: number;
  damping?: number;
}

/** Small fast PRNG; the sample only has to be repeatable, not secure. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samplePivots(n: number, k: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (n - i));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.slice(0, k);
}

export function pagerank(n: number, out: number[][], damping = 0.85, iterations = 100, tolerance = 1e-10): Float64Array {
  let rank = new Float64Array(n).fill(n ? 1 / n : 0);
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(n);
    // Records with no outgoing relationship hand their share to everyone, so rank is not lost.
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      const targets = out[i]!;
      if (targets.length === 0) { dangling += rank[i]!; continue; }
      const share = rank[i]! / targets.length;
      for (const j of targets) next[j]! += share;
    }
    const base = (1 - damping) / n + (damping * dangling) / n;
    let delta = 0;
    for (let i = 0; i < n; i++) {
      next[i] = base + damping * next[i]!;
      delta += Math.abs(next[i]! - rank[i]!);
    }
    rank = next;
    if (delta < tolerance) break;
  }
  return rank;
}

export function centrality(dataset: Dataset, options: CentralityOptions = {}): Centrality {
  const { exactUpTo = 2000, pivots: wanted = 256, seed = 7, damping = 0.85 } = options;
  const ids = [...dataset.entities.keys()];
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));

  const out: number[][] = Array.from({ length: n }, () => []);
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const r of dataset.relationships) {
    const s = index.get(r.sourceId);
    const t = index.get(r.targetId);
    if (s === undefined || t === undefined) continue;
    out[s]!.push(t);
    if (s !== t) { sets[s]!.add(t); sets[t]!.add(s); }
  }
  const adj = sets.map((s) => Int32Array.from(s));
  let links = 0;
  for (const a of adj) links += a.length;
  links /= 2;

  const degree = new Float64Array(n);
  for (let i = 0; i < n; i++) degree[i] = adj[i]!.length;

  const clustering = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nb = adj[i]!;
    const k = nb.length;
    if (k < 2) continue;
    let closed = 0;
    for (let a = 0; a < k; a++) {
      const sa = sets[nb[a]!]!;
      for (let b = a + 1; b < k; b++) if (sa.has(nb[b]!)) closed++;
    }
    clustering[i] = (2 * closed) / (k * (k - 1));
  }

  const estimated = n > exactUpTo;
  const sources = estimated ? samplePivots(n, Math.min(wanted, n), seed) : ids.map((_, i) => i);
  const betweenness = new Float64Array(n);
  const harmonic = new Float64Array(n);
  const dist = new Int32Array(n);
  const sigma = new Float64Array(n);
  const delta = new Float64Array(n);
  const stack = new Int32Array(n);
  const queue = new Int32Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);
  for (const s of sources) {
    dist.fill(-1); sigma.fill(0); delta.fill(0);
    for (const p of preds) p.length = 0;
    dist[s] = 0; sigma[s] = 1;
    let head = 0, tail = 0, top = 0;
    queue[tail++] = s;
    while (head < tail) {
      const v = queue[head++]!;
      stack[top++] = v;
      for (const w of adj[v]!) {
        if (dist[w]! < 0) { dist[w] = dist[v]! + 1; queue[tail++] = w; }
        if (dist[w] === dist[v]! + 1) { sigma[w]! += sigma[v]!; preds[w]!.push(v); }
      }
    }
    for (let i = 1; i < top; i++) harmonic[stack[i]!]! += 1 / dist[stack[i]!]!;
    while (top > 0) {
      const w = stack[--top]!;
      for (const v of preds[w]!) delta[v]! += (sigma[v]! / sigma[w]!) * (1 + delta[w]!);
      if (w !== s) betweenness[w]! += delta[w]!;
    }
  }
  // Undirected: every pair is counted from both ends. Normalising by the pairs that could pass
  // through a record puts 1 at "every shortest path crosses it". Sampling scales up by n / k.
  const scale = sources.length ? n / sources.length : 0;
  const pairs = ((n - 1) * (n - 2)) || 1;
  for (let i = 0; i < n; i++) betweenness[i] = (betweenness[i]! * scale) / pairs;
  // Harmonic closeness copes with a graph in pieces: an unreachable record adds 0, not infinity.
  const reach = sources.length && n > 1 ? sources.length - (estimated ? 0 : 1) : 1;
  for (let i = 0; i < n; i++) harmonic[i] = harmonic[i]! / (reach || 1);

  return {
    ids,
    values: { degree, pagerank: pagerank(n, out, damping), betweenness, closeness: harmonic, clustering },
    pivots: sources.length,
    estimated,
    links,
  };
}

export interface Distribution {
  min: number;
  max: number;
  counts: number[];
  /** Interpolated between neighbouring values, so labelled approximate. */
  median: number;
  p90: number;
  mean: number;
}

export function quantile(sorted: ArrayLike<number>, q: number): number {
  if (sorted.length === 0) return 0;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

export function distribution(values: ArrayLike<number>, bins = 20): Distribution {
  const sorted = Float64Array.from(values).sort();
  const n = sorted.length;
  const min = n ? sorted[0]! : 0;
  const max = n ? sorted[n - 1]! : 0;
  const counts = new Array<number>(bins).fill(0);
  const width = (max - min) / bins;
  let sum = 0;
  for (const v of sorted) {
    sum += v;
    counts[width > 0 ? Math.min(bins - 1, Math.floor((v - min) / width)) : 0]! += 1;
  }
  return { min, max, counts, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), mean: n ? sum / n : 0 };
}

/** Indexes into `ids`, highest first; ties fall back to the id so the order is stable. */
export function ranking(c: Centrality, metric: MetricKey, keep?: (index: number) => boolean): number[] {
  const v = c.values[metric];
  const order: number[] = [];
  for (let i = 0; i < c.ids.length; i++) if (!keep || keep(i)) order.push(i);
  return order.sort((a, b) => v[b]! - v[a]! || (c.ids[a]! < c.ids[b]! ? -1 : 1));
}
