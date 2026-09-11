# Measurements

These answer "how big can a graph be before this stops working", which the README used to assert
from one run and now reports from a file anybody can regenerate.

```sh
npm run bench                                  # the default ladder, realistically mixed
BENCH_SIZES=100000,200000 BENCH_MIX=0 npm run bench
node bench/write.ts /tmp/graph-50k 50000 0.35  # the same graph, on disk, for the browser
node bench/browser.mjs http://127.0.0.1:4300/ ./data/graph-50k   # see browser.md
```

`BENCH_MIX` is the share of edges that ignore their own cluster, and it matters more than the size.
It defaults to a third, which is the realistic case; at zero the graph has an obvious answer, Leiden
converges in a round or two, and the timings flatter themselves. The modularity column shows the
difference: about 0.62 mixed against about 0.99 clean, and the mixed run is roughly twice the work.

[browser.md](browser.md) is the same graphs measured in Chrome, which is where the ceiling actually
is: the algorithms are comfortable at fifty thousand entities and one layout choice is not.

These are measurements, not tests. They assert nothing, so they have their own config and stay out
of `npm test`.

[results.md](results.md) is the last run.
