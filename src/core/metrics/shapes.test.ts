import { describe, expect, it } from "vitest";
import type { Dataset, Entity, Relationship } from "../model";
import { inferRules, profileShapes, structureChecks } from "./shapes";

const entity = (id: string, type: string): Entity => ({ id, title: id, type, degree: 0, textUnitIds: [] });
const rel = (id: string, s: string, t: string, type: string): Relationship => ({ id, sourceId: s, targetId: t, type, textUnitIds: [] });
const graph = (entities: Entity[], rels: Relationship[]): Dataset => ({
  source: { kind: "graphrag", files: [] },
  entities: new Map(entities.map((e) => [e.id, e])),
  relationships: rels,
  partitions: [],
  textUnits: new Map(),
  documents: new Map(),
  covariates: [],
});

// Ten Vms, nine in a project, one of those in two: both rules hold for 90% and break once.
const vms = Array.from({ length: 10 }, (_, i) => entity(`vm${i}`, "Vm"));
const projects = [entity("p1", "Project"), entity("p2", "Project")];
const links = vms.slice(0, 9).map((v, i) => rel(`r${i}`, v.id, "p1", "inProject"));
links.push(rel("extra", "vm0", "p2", "inProject"));
const data = graph([...vms, ...projects], links);

describe("profileShapes", () => {
  it("profiles each type pair from both ends", () => {
    const out = profileShapes(data).find((p) => p.direction === "out")!;
    expect(out).toMatchObject({ focusType: "Vm", relType: "inProject", otherType: "Project", population: 10, withAny: 9, exactlyOne: 8, most: 2 });
    const back = profileShapes(data).find((p) => p.direction === "in")!;
    expect(back).toMatchObject({ focusType: "Project", withAny: 2, most: 9 });
  });
});

describe("inferRules", () => {
  it("proposes required and single at 90% and names who breaks them", () => {
    const rules = inferRules(data, { support: 0.85 }).filter((r) => r.profile.focusType === "Vm");
    const required = rules.find((r) => r.kind === "required")!;
    expect(required.violators).toEqual(["vm9"]);
    expect(required.passRate).toBeCloseTo(0.9);
    const single = rules.find((r) => r.kind === "single")!;
    expect(single.violators).toEqual(["vm0"]);
    expect(single.scope).toBe(9);
  });

  it("proposes nothing below the support or for small types", () => {
    expect(inferRules(data, { support: 0.95 }).filter((r) => r.profile.focusType === "Vm")).toEqual([]);
    expect(inferRules(data).some((r) => r.profile.focusType === "Project")).toBe(false);
  });

  it("puts broken rules before kept ones", () => {
    const kept = Array.from({ length: 6 }, (_, i) => entity(`d${i}`, "Disk"));
    const g = graph([...vms, ...projects, ...kept], [...links, ...kept.map((d, i) => rel(`k${i}`, d.id, "vm1", "attachedTo"))]);
    const rules = inferRules(g, { support: 0.85 });
    expect(rules[0]!.violators.length).toBeGreaterThan(0);
    expect(rules.at(-1)!.violators).toEqual([]);
  });
});

describe("structureChecks", () => {
  it("finds duplicates, self-loops, overloaded names and untyped records", () => {
    const es = [entity("a", "A"), entity("b", "B"), entity("c", "C"), entity("d", "D"), entity("e", "")];
    const g = graph(es, [
      rel("1", "a", "b", "x"), rel("2", "a", "b", "x"), rel("3", "a", "a", "y"),
      rel("4", "a", "c", "z"), rel("5", "b", "c", "z"), rel("6", "c", "d", "z"), rel("7", "d", "a", "z"),
    ]);
    const found = Object.fromEntries(structureChecks(g).map((f) => [f.kind, f]));
    expect(found.duplicate).toMatchObject({ count: 1, examples: ["a"] });
    expect(found["self-loop"]).toMatchObject({ count: 1 });
    expect(found["overloaded-name"]).toMatchObject({ count: 4, examples: ["z"] });
    expect(found.untyped).toMatchObject({ count: 1, examples: ["e"] });
  });

  it("reports nothing on a clean graph", () => {
    expect(structureChecks(data)).toEqual([]);
  });
});
