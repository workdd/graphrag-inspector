import { describe, expect, it } from "vitest";
import type { Dataset, Entity, Relationship } from "../model";
import { peekGraph } from "./peek";

const entity = (id: string): Entity => ({ id, title: id, type: "T", degree: 0, textUnitIds: [] });
const rel = (id: string, s: string, t: string, type = "r"): Relationship => ({ id, sourceId: s, targetId: t, type, textUnitIds: [] });
const graph = (ids: string[], rels: Relationship[]): Dataset => ({
  source: { kind: "graphrag", files: [] },
  entities: new Map(ids.map((id) => [id, entity(id)])),
  relationships: rels,
  partitions: [],
  textUnits: new Map(),
  documents: new Map(),
  covariates: [],
});

// a - b - c - d, and a - e
const chain = graph(["a", "b", "c", "d", "e"], [rel("1", "a", "b"), rel("2", "b", "c"), rel("3", "c", "d"), rel("4", "e", "a")]);

describe("peekGraph", () => {
  it("takes one hop by default, both directions", () => {
    const p = peekGraph(chain, "a")!;
    expect(p.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "e"]);
    expect(p.edges).toHaveLength(2);
    expect(p.hidden).toEqual([0]);
  });

  it("marks the hop of each node", () => {
    const p = peekGraph(chain, "a", 2)!;
    expect(Object.fromEntries(p.nodes.map((n) => [n.id, n.hop]))).toEqual({ a: 0, b: 1, e: 1, c: 2 });
  });

  it("keeps the busiest neighbours under the cap and counts the rest", () => {
    const star = graph(["s", "x", "y", "z", "w"], [rel("1", "s", "x"), rel("2", "s", "y"), rel("3", "s", "z"), rel("4", "x", "w"), rel("5", "s", "w")]);
    const p = peekGraph(star, "s", 1, 3)!;
    expect(p.nodes.map((n) => n.id)).toEqual(["s", "w", "x"]);
    expect(p.hidden).toEqual([2]);
  });

  it("folds parallel relationships into one line with a count", () => {
    const p = peekGraph(graph(["a", "b"], [rel("1", "a", "b"), rel("2", "a", "b"), rel("3", "a", "b", "other")]), "a")!;
    expect(p.edges.map((e) => [e.type, e.count]).sort()).toEqual([["other", 1], ["r", 2]]);
  });

  it("returns null for a record that is not loaded", () => {
    expect(peekGraph(chain, "zz")).toBeNull();
  });
});

describe("peekGraph bundles", () => {
  // A hub with ten Vms and two Disks: the Vms fold, the Disks stay named.
  const ids = ["hub", ...Array.from({ length: 10 }, (_, i) => `vm${i}`), "d1", "d2", "far"];
  const ents = new Map(ids.map((id) => [id, { id, title: id, type: id.startsWith("vm") ? "Vm" : id.startsWith("d") ? "Disk" : "Hub", degree: 0, textUnitIds: [] } as Entity]));
  const rels = [
    ...Array.from({ length: 10 }, (_, i) => rel(`v${i}`, `vm${i}`, "hub", "inProject")),
    rel("x1", "hub", "d1", "owns"), rel("x2", "hub", "d2", "owns"),
    rel("f1", "vm0", "far", "runsOn"), rel("f2", "d1", "far", "attached"),
  ];
  const g: Dataset = { ...graph([], rels), entities: ents };

  it("folds a large group into one node with the member ids and a counted line", () => {
    const p = peekGraph(g, "hub")!;
    const bundle = p.nodes.find((n) => n.bundle)!;
    expect(bundle.bundle).toMatchObject({ type: "Vm", relationship: "inProject" });
    expect(bundle.bundle!.ids).toHaveLength(10);
    expect(p.nodes.filter((n) => !n.bundle).map((n) => n.id).sort()).toEqual(["d1", "d2", "hub"]);
    expect(p.edges.find((e) => e.target === "hub" && e.source === bundle.id)!.count).toBe(10);
  });

  it("keeps a second-hop record reached through a named neighbour", () => {
    const p = peekGraph(g, "hub", 2)!;
    expect(p.nodes.some((n) => n.id === "far")).toBe(true);
    expect(p.edges.some((e) => e.source === "d1" && e.target === "far")).toBe(true);
    expect(p.edges.some((e) => e.source === "vm0")).toBe(false);
  });
});

describe("peekGraph bundles past the cap", () => {
  it("counts every member of a fold even when the group is larger than the cap", () => {
    const n = 100;
    const ids = ["hub", ...Array.from({ length: n }, (_, i) => `vm${i}`)];
    const ents = new Map(ids.map((id) => [id, { id, title: id, type: id === "hub" ? "Hub" : "Vm", degree: 0, textUnitIds: [] } as Entity]));
    const g: Dataset = { ...graph([], Array.from({ length: n }, (_, i) => rel(`v${i}`, `vm${i}`, "hub", "inProject"))), entities: ents };
    const p = peekGraph(g, "hub", 1, 10)!;
    expect(p.nodes).toHaveLength(2);
    expect(p.nodes.find((x) => x.bundle)!.bundle!.ids).toHaveLength(n);
    expect(p.edges[0]!.count).toBe(n);
    expect(p.hidden).toEqual([0]);
  });
});
