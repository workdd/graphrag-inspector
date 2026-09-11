// A graph of any size, in the two CSV tables the loader reads.
//
// The shape matters as much as the size. A benchmark on a random graph measures nothing useful: a
// community detector has nothing to find, so Leiden converges in one round and reports a ceiling
// nobody will ever hit. This generator keeps the structure of the graphs people actually have:
// dense clusters, sparse traffic between them, and a handful of shared nodes everything touches,
// which is what makes a layout and a clustering run expensive.
export interface Shape {
  entities: number;
  /** Relationships per entity. Four is a service graph; ten is a citation graph. */
  edgeFactor: number;
  /** Members per cluster, before the bridges. */
  cluster?: number;
  /** Nodes half the graph points at. The hub is what every clustering run has to survive. */
  hubs?: number;
  /**
   * The share of edges that ignore the clusters and land anywhere. Zero makes a graph with an
   * obvious answer, which is the wrong thing to time: Leiden converges in a round or two and the
   * measurement flatters itself. Real graphs sit around a third, and a detector has to work for it.
   */
  mix?: number;
}

export interface Tables {
  nodes: string;
  edges: string;
  bytes: number;
}

/** Mulberry32: a seeded generator, so a measurement can be repeated. */
const random = (seed: number): (() => number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const KINDS = ["service", "queue", "store", "team", "dataset"];
const EDGE_TYPES = ["calls", "reads", "publishes", "subscribes", "owns"];

export function synthetic(shape: Shape, seed = 1): Tables {
  const rand = random(seed);
  const size = shape.cluster ?? 40;
  const hubs = shape.hubs ?? 4;
  const mix = shape.mix ?? 0;
  const clusters = Math.max(1, Math.ceil((shape.entities - hubs) / size));

  const nodeRows: string[] = ["id,name,type,description"];
  for (let c = 0; c < clusters; c += 1) {
    for (let i = 0; i < size; i += 1) {
      const id = `c${c}-n${i}`;
      if (nodeRows.length > shape.entities - hubs) break;
      nodeRows.push(`${id},${id},${KINDS[(c + i) % KINDS.length]},"member ${i} of cluster ${c}, which is one of ${clusters}"`);
    }
  }
  for (let h = 0; h < hubs; h += 1) nodeRows.push(`hub${h},hub ${h},store,shared store every cluster touches`);

  const edgeRows: string[] = ["source,target,type,weight"];
  const ends = shape.entities * shape.edgeFactor;
  // Inside a cluster: the structure a detector should find.
  for (let c = 0; c < clusters; c += 1) {
    for (let i = 0; i < size; i += 1) {
      for (let k = 0; k < shape.edgeFactor; k += 1) {
        const type = EDGE_TYPES[k % EDGE_TYPES.length];
        const weight = 1 + Math.floor(rand() * 9);
        if (rand() < mix) {
          // Anywhere in the graph, which is what blurs the clusters.
          const c2 = Math.floor(rand() * clusters);
          edgeRows.push(`c${c}-n${i},c${c2}-n${Math.floor(rand() * size)},${type},${weight}`);
          continue;
        }
        const j = Math.floor(rand() * size);
        if (j === i) continue;
        edgeRows.push(`c${c}-n${i},c${c}-n${j},${type},${weight}`);
      }
    }
  }
  // Between clusters: sparse, so the levels above the finest have something to merge.
  for (let c = 0; c < clusters; c += 1) {
    const other = (c + 1) % clusters;
    for (let k = 0; k < 3; k += 1) {
      edgeRows.push(`c${c}-n${Math.floor(rand() * size)},c${other}-n${Math.floor(rand() * size)},calls,1`);
    }
  }
  // And the hub, which half the graph points at.
  for (let c = 0; c < clusters; c += 1) {
    for (let h = 0; h < hubs; h += 1) {
      if (rand() < 0.5) edgeRows.push(`c${c}-n${Math.floor(rand() * size)},hub${h},reads,1`);
    }
  }

  const nodes = nodeRows.join("\n");
  const edges = edgeRows.join("\n");
  void ends;
  return { nodes, edges, bytes: nodes.length + edges.length };
}
