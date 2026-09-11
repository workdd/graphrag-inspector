# Measured in a browser

Chrome 1400x900, `node scripts/serve.mjs --data <folder>`, graphs from `bench/write.ts` with a
third of the edges ignoring their own cluster. Regenerate with
`node bench/browser.mjs <url> <?data= value> [layout budget seconds]`.

`on screen` is when a canvas or a table first appears. The other number is when the app stops saying
it is still laying out, which is the only honest finish line.

| | 10,000 entities, 40,527 edges | 50,000 entities, 202,979 edges |
| --- | --- | --- |
| Load to Health | 301 ms | 561 ms |
| Find communities | 492 ms, 3,262 communities on 5 levels | 2,497 ms, 16,149 on 6 levels |
| Types | 1,028 ms (on screen at 171 ms) | 1,322 ms (467 ms) |
| Graph | 1,259 ms (381 ms) | 1,271 ms (429 ms) |
| Communities | 2,036 ms (844 ms) | 3,380 ms (779 ms) |
| Quality | 1,722 ms (469 ms) | 4,594 ms (1,520 ms) |
| Matrix | 1,265 ms (427 ms) | 1,451 ms (606 ms) |
| Peak heap | 125 MB | 386 MB |
| **Every entity, free arrangement** | **unfinished after 120 s** | **unfinished after 120 s** |

## The one thing that does not scale

Every view above is fine at fifty thousand entities because none of them draws one node per entity:
the graph opens on the schema, the communities open as circles per community, and a community's own
graph draws its members. Choosing **Show: all of the data** with **Arrange: free** is the one path
that asks for a node per record, and it does not finish.

Where it stops finishing, measured on the same machine:

| entities | free layout over all of them |
| --- | --- |
| 1,000 | 16.7 s |
| 2,500 | unfinished after 180 s |
| 5,000 | unfinished after 180 s |
| 10,000 | unfinished after 13 min |

The layout runs in a worker, so the page stays responsive throughout (6 to 20 ms to the next frame)
and the app says `Laying out 12,539 nodes…` while it works. It does not say that the number it is
working towards will not arrive, and there is no visible way to take the choice back. That is
[issue #14](https://github.com/workdd/graphrag-inspector/issues/14), not a property of the data.
