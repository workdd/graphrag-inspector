# What it reads

Every file the loader looks for, across GraphRAG versions and plain CSV.
[README.md](../README.md#what-it-reads) has the short version.


| File | Used for |
| --- | --- |
| `entities.parquet` | Entity titles, types, descriptions. Required. |
| `relationships.parquet` | Edges between entity titles. Required. |
| `communities.parquet` | Levels, parents, members. Recommended: without it only the entity list and neighbourhood graphs are available (`public/samples/minimal` is such a set). |
| `community_reports.parquet` | Summaries, findings and ranks. Global search reads these. |
| `text_units.parquet`, `documents.parquet` | Source chunks and documents; the inspector shows the text behind an entity, relationship or community. |
| `covariates.parquet` | Claims about entities, listed on the entity panel and offered to local search. |
| `embeddings.parquet` | Optional sidecar of entity vectors, written by `tools/embed_index`. Local search and the embedding space need vectors; without this file the Ask tab offers to build them in the browser instead. |
| `<label>_communities.parquet` | Any additional community set (for example `leiden_communities.parquet`) becomes a switchable partition. |
| `nodes.csv`, `edges.csv` | A graph that never went near GraphRAG. Two tables, or just the edge table with its ends taken as the nodes. Column names are guessed from the usual ones and what was guessed is reported. |
| `example-run.json` | Optional saved run. When a folder carries one, the Ask tab offers it as one click, so the tab can be read before any provider is configured. |

Levels are shown from the root down: the root reads L0 and children count up, which is GraphRAG's
own numbering. A file that numbers its roots highest (Apache AGE resource tiers) or starts at one is
renumbered for display only, with the file's own number in the tooltip and a note beside the levels.

File names from GraphRAG 0.3 to 2.x are recognized, including the `create_final_` prefix. When an
older output has no `entity_ids` column, members are inferred from `relationship_ids` and the
integrity panel says so (`public/samples/legacy` is such a set). Exports from Apache AGE that
follow the same layout load as well.

Size: a synthetic index with 9,211 entities, 23,810 relationships and 1,537 communities opens in
under a second on a laptop; the collapsed map, the quality view and an 85-entity community graph
each take about half a second (`samples/generate_sample.py --scale 53 --edge-factor 5`).

## Opening a folder

The dev server publishes `local-data/` at `./data/<name>`, so `?data=./data/<name>` opens it. To make
one open by default, copy `.env.example` to `.env.development.local` and set
`VITE_DEFAULT_DATA=./data/<name>`. Any folder served over HTTP works the same way with `?data=<url>`.

Several folders can be offered at once. `npm run serve -- --data a --data b` and the dev server both
publish `data/index.json`, which the app turns into buttons on the load screen and a picker in the
top bar. A folder's `manifest.json` may carry `"label"` to name it there.

To serve a built copy together with a graph folder, without the dev server:

```sh
npm run build
npm run serve -- --data ~/graphrag/output     # http://127.0.0.1:4180/?data=./data/output
```

That server is also what `npm pack` puts in the tarball, so a built copy can be moved to a machine
that has Node and nothing else. The package is not on a registry.

A `Dockerfile` builds a static image served by nginx; mount a graph folder under
`/usr/share/nginx/html/data/<name>` and open `?data=./data/<name>`. It has not been exercised on a
machine with Docker yet, which is
[issue #11](https://github.com/workdd/graphrag-inspector/issues/11).
