# Measurements

These answer "how big can a graph be before this stops working", which the README used to assert
from one run and now reports from a file anybody can regenerate.

```sh
npm run bench                                     # the default ladder
BENCH_SIZES=100000,200000 BENCH_MIX=0.35 npm run bench
node bench/write.ts /tmp/graph-50k 50000 0.35     # the same graph, on disk, for the browser
```

`BENCH_MIX` is the share of edges that ignore their own cluster. It matters more than the size:
at zero the graph has an obvious answer, Leiden converges in a round or two, and the timings
flatter themselves. A third is the realistic case, and the modularity column shows the difference
(about 0.99 against about 0.62).

These are measurements, not tests. They assert nothing, so they have their own config and stay out
of `npm test`.

[results.md](results.md) is the last run.
