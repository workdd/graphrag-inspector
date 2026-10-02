// Rules the data almost keeps, and the records that break them.
//
// A SHACL shape says "every Vm has exactly one project". An index exported from a database never
// ships its shapes, but the data shows them: when 97% of Vm records have one project link, the 3%
// without are far more likely gaps than a second kind of Vm. Each (type, relationship, other type)
// seen in the graph is profiled from both ends, and a rule is proposed when enough of the type keeps
// it. The rule is a guess the reader confirms; the records that break it are facts.
//
// Alongside, structural checks a property graph can fail without any rule: the same relationship
// recorded twice, a record pointing at itself, one relationship name joining many type pairs.
import type { Dataset } from "../model";

export type Direction = "out" | "in";

export interface ShapeProfile {
  /** The type the rule is about: the source for "out", the target for "in". */
  focusType: string;
  relType: string;
  /** The type at the other end. */
  otherType: string;
  direction: Direction;
  /** Records of focusType. */
  population: number;
  /** Records with at least one such link. */
  withAny: number;
  /** Records with exactly one. */
  exactlyOne: number;
  /** Most links any one record has. */
  most: number;
  /** count per record id, only for records with at least one link. */
  counts: Map<string, number>;
}

export type RuleKind = "required" | "single";

export interface ShapeRule {
  profile: ShapeProfile;
  kind: RuleKind;
  /** Records the rule applies to: all of the type for "required", those with any link for "single". */
  scope: number;
  /** Records that keep it. */
  kept: number;
  passRate: number;
  /** Record ids that break it: none for "required", more than one for "single". */
  violators: string[];
}

export interface ShapeOptions {
  /** Share of the scope that must keep a rule before it is proposed. */
  support?: number;
  /** Types smaller than this say too little to propose anything. */
  minPopulation?: number;
}

const key = (...parts: string[]) => parts.join("\u0000");

export function profileShapes(dataset: Dataset): ShapeProfile[] {
  const population = new Map<string, number>();
  for (const e of dataset.entities.values()) population.set(e.type, (population.get(e.type) ?? 0) + 1);
  const profiles = new Map<string, ShapeProfile>();
  const bump = (focusId: string, focusType: string, relType: string, otherType: string, direction: Direction) => {
    const k = key(focusType, relType, otherType, direction);
    let p = profiles.get(k);
    if (!p) {
      p = { focusType, relType, otherType, direction, population: population.get(focusType) ?? 0, withAny: 0, exactlyOne: 0, most: 0, counts: new Map() };
      profiles.set(k, p);
    }
    p.counts.set(focusId, (p.counts.get(focusId) ?? 0) + 1);
  };
  for (const r of dataset.relationships) {
    const s = dataset.entities.get(r.sourceId);
    const t = dataset.entities.get(r.targetId);
    if (!s || !t) continue;
    bump(s.id, s.type, r.type, t.type, "out");
    bump(t.id, t.type, r.type, s.type, "in");
  }
  for (const p of profiles.values()) {
    p.withAny = p.counts.size;
    for (const n of p.counts.values()) {
      if (n === 1) p.exactlyOne++;
      if (n > p.most) p.most = n;
    }
  }
  return [...profiles.values()];
}

/**
 * Proposes "required" when at least `support` of the type has the link, and "single" when at least
 * `support` of those that have it have exactly one. A rule every record keeps is still returned: it
 * tells the reader what the data guarantees.
 */
export function inferRules(dataset: Dataset, options: ShapeOptions = {}): ShapeRule[] {
  const { support = 0.9, minPopulation = 5 } = options;
  const rules: ShapeRule[] = [];
  for (const p of profileShapes(dataset)) {
    if (p.population < minPopulation) continue;
    if (p.withAny / p.population >= support) {
      const violators: string[] = [];
      for (const e of dataset.entities.values()) if (e.type === p.focusType && !p.counts.has(e.id)) violators.push(e.id);
      rules.push({ profile: p, kind: "required", scope: p.population, kept: p.withAny, passRate: p.withAny / p.population, violators });
    }
    if (p.withAny >= minPopulation && p.exactlyOne / p.withAny >= support) {
      const violators = [...p.counts].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([id]) => id);
      rules.push({ profile: p, kind: "single", scope: p.withAny, kept: p.exactlyOne, passRate: p.exactlyOne / p.withAny, violators });
    }
  }
  // Broken rules first, the nearest to holding on top: those are the likeliest data gaps.
  return rules.sort((a, b) =>
    Number(b.violators.length > 0) - Number(a.violators.length > 0) ||
    b.passRate - a.passRate ||
    b.scope - a.scope ||
    a.profile.focusType.localeCompare(b.profile.focusType) ||
    a.profile.relType.localeCompare(b.profile.relType));
}

export type StructureKind = "duplicate" | "self-loop" | "overloaded-name" | "untyped";

export interface StructureFinding {
  kind: StructureKind;
  count: number;
  /** A few examples to open: entity ids, or relationship type names for "overloaded-name". */
  examples: string[];
  /** For "overloaded-name": the type pairs the name joins. */
  pairs?: string[];
}

export function structureChecks(dataset: Dataset, overloadedAt = 4): StructureFinding[] {
  const seen = new Map<string, number>();
  const duplicateEnds: string[] = [];
  const loops: string[] = [];
  const pairsByName = new Map<string, Set<string>>();
  for (const r of dataset.relationships) {
    const s = dataset.entities.get(r.sourceId);
    const t = dataset.entities.get(r.targetId);
    if (!s || !t) continue;
    const k = key(r.sourceId, r.type, r.targetId);
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    if (n === 2) duplicateEnds.push(r.sourceId);
    if (r.sourceId === r.targetId) loops.push(r.sourceId);
    let pairs = pairsByName.get(r.type);
    if (!pairs) pairsByName.set(r.type, (pairs = new Set()));
    pairs.add(`${s.type} → ${t.type}`);
  }
  let duplicates = 0;
  for (const n of seen.values()) duplicates += n - 1;
  const untyped = [...dataset.entities.values()].filter((e) => !e.type || e.type.trim() === "").map((e) => e.id);
  const out: StructureFinding[] = [];
  if (duplicates) out.push({ kind: "duplicate", count: duplicates, examples: [...new Set(duplicateEnds)].slice(0, 8) });
  if (loops.length) out.push({ kind: "self-loop", count: loops.length, examples: [...new Set(loops)].slice(0, 8) });
  for (const [name, pairs] of pairsByName) {
    if (pairs.size >= overloadedAt) out.push({ kind: "overloaded-name", count: pairs.size, examples: [name], pairs: [...pairs].sort() });
  }
  if (untyped.length) out.push({ kind: "untyped", count: untyped.length, examples: untyped.slice(0, 8) });
  return out;
}
