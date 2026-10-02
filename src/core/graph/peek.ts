// A record and what sits around it, small enough to draw in the side column. The reader stays on
// the page they were reading; the graph tab is one button away when this is not enough.
//
// Breadth-first from the seed. Large groups of first-hop neighbours fold into one counted node; when
// the rest still overflow the cap, the busiest are kept and the others counted, not dropped silently.
import type { Dataset } from "../model";

export interface PeekNode {
  id: string;
  /** Hops from the seed: 0, 1 or 2. */
  hop: number;
  /** Set when the node stands for many neighbours that share a type and a relationship. */
  bundle?: { type: string; relationship: string; ids: string[] };
}

export interface PeekEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  /** Relationships folded into this one line: same ends, same name. */
  count: number;
}

export interface PeekGraph {
  seed: string;
  nodes: PeekNode[];
  edges: PeekEdge[];
  /** Neighbours left out at each hop because of the cap, by hop. */
  hidden: number[];
}

/** Neighbours sharing a type and a relationship fold into one node past this many. */
export const BUNDLE_AT = 6;
export const BUNDLE_PREFIX = "peek-bundle:";

export function peekGraph(dataset: Dataset, seed: string, hops = 1, cap = 40, bundleAt = BUNDLE_AT): PeekGraph | null {
  if (!dataset.entities.has(seed)) return null;
  const adjacent = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let set = adjacent.get(a);
    if (!set) adjacent.set(a, (set = new Set()));
    set.add(b);
  };
  // The relationship that first joins a neighbour to the seed, for grouping.
  const firstRel = new Map<string, string>();
  for (const r of dataset.relationships) {
    if (r.sourceId === r.targetId || !dataset.entities.has(r.sourceId) || !dataset.entities.has(r.targetId)) continue;
    link(r.sourceId, r.targetId);
    link(r.targetId, r.sourceId);
    if (r.sourceId === seed && !firstRel.has(r.targetId)) firstRel.set(r.targetId, r.type);
    if (r.targetId === seed && !firstRel.has(r.sourceId)) firstRel.set(r.sourceId, r.type);
  }
  const degree = (id: string) => adjacent.get(id)?.size ?? 0;
  const byDegree = (a: string, b: string) => degree(b) - degree(a) || (a < b ? -1 : 1);

  // First hop, all of it. A hub's hundred Vms say "a hundred Vms", not a hundred names: each large
  // group sharing a type and a relationship folds into one node before anything is cut.
  const groups = new Map<string, string[]>();
  for (const n of adjacent.get(seed) ?? []) {
    const key = `${dataset.entities.get(n)!.type}\u0000${firstRel.get(n) ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const bundleOf = new Map<string, string>();
  const bundles: PeekNode[] = [];
  const single: string[] = [];
  for (const [key, ids] of groups) {
    if (ids.length <= bundleAt) { single.push(...ids); continue; }
    const [type, relationship] = key.split("\u0000") as [string, string];
    const id = `${BUNDLE_PREFIX}${key}`;
    for (const m of ids) bundleOf.set(m, id);
    bundles.push({ id, hop: 1, bundle: { type, relationship, ids: ids.sort(byDegree) } });
  }
  // When the named neighbours still overflow, the busiest stay and the rest are counted.
  single.sort(byDegree);
  const room1 = Math.max(0, cap - 1 - bundles.length);
  const hop = new Map<string, number>([[seed, 0]]);
  for (const id of single.slice(0, room1)) hop.set(id, 1);
  const hidden = [Math.max(0, single.length - room1)];

  // Second hop, only out of the neighbours drawn by name.
  if (hops > 1) {
    const next = new Set<string>();
    for (const [id, h] of hop) if (h === 1) for (const n of adjacent.get(id) ?? []) if (!hop.has(n) && !bundleOf.has(n) && n !== seed) next.add(n);
    const ranked = [...next].sort(byDegree);
    const room2 = Math.max(0, cap - hop.size - bundles.length);
    for (const id of ranked.slice(0, room2)) hop.set(id, 2);
    hidden.push(ranked.length - Math.min(ranked.length, room2));
  }

  const edges = new Map<string, PeekEdge>();
  const add = (source: string, target: string, type: string, key: string) => {
    const e = edges.get(key);
    if (e) e.count++;
    else edges.set(key, { id: key, source, target, type, count: 1 });
  };
  for (const r of dataset.relationships) {
    if (r.sourceId === r.targetId) continue;
    const s = bundleOf.get(r.sourceId), t = bundleOf.get(r.targetId);
    // A folded group keeps only its lines to the seed, counted.
    if (s && r.targetId === seed) { add(s, seed, r.type, `${s}<${r.type}`); continue; }
    if (t && r.sourceId === seed) { add(seed, t, r.type, `${t}>${r.type}`); continue; }
    if (!hop.has(r.sourceId) || !hop.has(r.targetId)) continue;
    // The outer ring linked among itself is noise at this size; keep lines that lead back inward.
    if (hops > 1 && hop.get(r.sourceId) === hops && hop.get(r.targetId) === hops) continue;
    add(r.sourceId, r.targetId, r.type, `${r.sourceId}\u0000${r.type}\u0000${r.targetId}`);
  }
  return {
    seed,
    nodes: [...[...hop].map(([id, h]) => ({ id, hop: h })), ...bundles],
    edges: [...edges.values()],
    hidden,
  };
}
