import { describe, expect, it } from "vitest";
import type { Dataset, Entity, Relationship } from "../model";
import { centrality, distribution, pagerank, quantile, ranking } from "./centrality";

const entity = (id: string, type = "T"): Entity => ({ id, title: id, type, degree: 0, textUnitIds: [] });
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
const at = (c: ReturnType<typeof centrality>, metric: keyof ReturnType<typeof centrality>["values"], id: string) =>
  c.values[metric][c.ids.indexOf(id)]!;

describe("centrality", () => {
  // Two triangles joined through c-d: the bridge ends carry every path between the halves.
  const barbell = graph(["a", "b", "c", "d", "e", "f"], [
    rel("1", "a", "b"), rel("2", "b", "c"), rel("3", "a", "c"), rel("4", "c", "d"), rel("5", "d", "e"), rel("6", "e", "f"), rel("7", "d", "f"),
  ]);

  it("gives the middle of a path every shortest path", () => {
    const c = centrality(graph(["a", "b", "c"], [rel("1", "a", "b"), rel("2", "b", "c")]));
    expect(at(c, "betweenness", "b")).toBeCloseTo(1);
    expect(at(c, "betweenness", "a")).toBe(0);
    expect(at(c, "closeness", "b")).toBeCloseTo(1);
    expect(at(c, "closeness", "a")).toBeCloseTo((1 + 0.5) / 2);
    expect(c.estimated).toBe(false);
  });

  it("matches the barbell's known values", () => {
    const c = centrality(barbell);
    // c lies on the paths from a or b to d, e or f: 6 of the 10 pairs that exclude it.
    expect(at(c, "betweenness", "c")).toBeCloseTo(0.6);
    expect(at(c, "betweenness", "a")).toBe(0);
    expect(at(c, "clustering", "a")).toBeCloseTo(1);
    expect(at(c, "clustering", "c")).toBeCloseTo(1 / 3);
    expect(at(c, "degree", "c")).toBe(3);
    expect(c.links).toBe(7);
  });

  it("counts parallel relationships and self-loops once for the undirected measures", () => {
    const c = centrality(graph(["a", "b"], [rel("1", "a", "b"), rel("2", "a", "b", "s"), rel("3", "b", "a"), rel("4", "a", "a")]));
    expect(at(c, "degree", "a")).toBe(1);
    expect(c.links).toBe(1);
  });

  it("ignores relationships whose ends were not loaded", () => {
    const c = centrality(graph(["a"], [rel("1", "a", "zz")]));
    expect(at(c, "degree", "a")).toBe(0);
  });

  it("estimates from a repeatable sample past the exact limit and says so", () => {
    const one = centrality(barbell, { exactUpTo: 3, pivots: 4, seed: 1 });
    const two = centrality(barbell, { exactUpTo: 3, pivots: 4, seed: 1 });
    expect(one.estimated).toBe(true);
    expect(one.pivots).toBe(4);
    expect([...one.values.betweenness]).toEqual([...two.values.betweenness]);
    // The bridge ends stay on top even from a sample.
    const top = ranking(one, "betweenness").slice(0, 2).map((i) => one.ids[i]).sort();
    expect(top).toEqual(["c", "d"]);
  });
});

describe("pagerank", () => {
  it("sums to one and favours the record everything points at", () => {
    const rank = pagerank(3, [[2], [2], []]);
    expect(rank.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    expect(rank[2]!).toBeGreaterThan(rank[0]!);
    expect(rank[0]).toBeCloseTo(rank[1]!);
  });
});

describe("distribution", () => {
  it("bins every value and interpolates the quantiles", () => {
    const d = distribution([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
    expect(d.counts).toEqual([2, 2, 2, 2, 2]);
    expect(d.median).toBeCloseTo(4.5);
    expect(d.p90).toBeCloseTo(8.1);
    expect(d.mean).toBeCloseTo(4.5);
  });

  it("puts identical values in one bin", () => {
    expect(distribution([2, 2, 2], 4).counts).toEqual([3, 0, 0, 0]);
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe("ranking", () => {
  it("keeps only the records asked for, highest first", () => {
    const c = centrality(graph(["a", "b", "c"], [rel("1", "a", "b"), rel("2", "b", "c")]));
    expect(ranking(c, "degree").map((i) => c.ids[i])).toEqual(["b", "a", "c"]);
    expect(ranking(c, "degree", (i) => c.ids[i] !== "b").map((i) => c.ids[i])).toEqual(["a", "c"]);
  });
});
