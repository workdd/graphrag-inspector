# GraphRAG Inspector

**English** · [한국어](README.ko.md)

**Open a graph in your browser, find out whether it is any good, ask it a question, and follow the
answer back to the exact records it used.** No server, no install, nothing uploaded.

[![ci](https://github.com/workdd/graphrag-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/workdd/graphrag-inspector/actions/workflows/ci.yml)
[![live demo](https://img.shields.io/badge/demo-live-1f6feb)](https://workdd.github.io/graphrag-inspector/)
[![license MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![runs in the browser](https://img.shields.io/badge/backend-none-black)](#try-it)
[![GraphRAG 0.3 to 2.x](https://img.shields.io/badge/GraphRAG-0.3%20to%202.x-black)](docs/formats.md)

![The sample index opened on the types it was counted from, then the Health view naming two things to fix, then the whole graph with community clouds, then a question answered with citations and one of them followed to the record it names and to the evidence graph](docs/screenshots/ask.gif)

**[Open the demo](https://workdd.github.io/graphrag-inspector/) → Ask → See a saved run.**
No API key needed: the sample ships with a recorded run, so the whole answer-to-evidence path is one
click away.

A [Microsoft GraphRAG](https://github.com/microsoft/graphrag) index is one way a graph arrives. A
node table and an edge table are another, and everything except the reports, the source text and the
vectors works the same on both: the schema is counted from the rows, and the communities are found
here when the graph did not bring any.

## The problem this solves

Indexing with GraphRAG is expensive. It reads every document with a model, extracts entities and
relationships, resolves them, clusters them into communities and then writes a summary of each
community. On a medium corpus that is thousands of model calls and a real bill.

What comes back is a folder of Parquet files and a vector store. You can query it and read the
answer. You cannot see what the index looks like, whether the communities mean anything, which
records a question actually reached, or why the answer left something out. When an answer is wrong,
the usual next step is to add print statements to a Python script and index again.

```
graphrag index  ──►  output/*.parquet  ──►  your application
                            │                      │
                            ▼                      │ the answer is wrong,
                     this tool, in a browser  ◄─────┘ or nobody trusts it
                            │
   is the index worth building on?  ·  what did the question actually reach?
   what did the model ignore?  ·  what exactly left my machine?
```

## What you would use it for

| When you need to | Open |
| --- | --- |
| Decide whether an index is worth building on | **Health**. It names what is wrong rather than leaving you to read the numbers, and says what each finding costs a search and what to change upstream. |
| Work out why an answer was wrong, or prove one to a reviewer | **Ask**. What was ranked, what reached the prompt, what the budget cut, and what the model cited out of everything it was handed. Every citation opens the record it names. |
| Answer a privacy question about what leaves the machine | **Ask** → **Show the prompt sent to the model**. The exact messages, and the run drawn with the calls that left the browser in red. |
| Pick up a graph somebody else built | **Types** first. The entity types and the relationships that actually occur between them, counted from the rows rather than declared. |

It is a viewer and a debugger, not a serving layer. Point your application at `graphrag query`; come
here when you need to see what that query is standing on.

## Why this and not a graph viewer

A graph viewer draws your nodes. This draws the way the graph is actually organized, and then shows
you what a search does with it.

- **Communities first, not a hairball.** The graph opens on its own schema and its community
  hierarchy. If it arrived without communities, they are found here.
- **Answers you can check.** Every citation is a button that opens the record it names, with the
  exact text that went into the prompt. Records that were retrieved and *not* cited stay on screen,
  so what the model ignored is as visible as what it used.
- **The pipeline is on screen.** Retrieval, the token budget, each model call with its measured
  milliseconds, and the prompt verbatim. Local and global search both.
- **Nothing to stand up.** A folder and a browser tab. The official `unified-search-app` needs
  Python, Streamlit and a pinned GraphRAG install.

Status: 0.4, alpha. One person's project so far. See [docs/ROADMAP.md](docs/ROADMAP.md) for what
comes next and the [open issues](https://github.com/workdd/graphrag-inspector/issues) for what is
known to be missing.

![Health of the sample index: the counts, then four findings, each naming what was measured, which search it affects and what to change](docs/screenshots/health-sample.png)

![Ask tab: a question about what a queue's removal would affect, answered with inline citations back to entities, relationships, reports and claims](docs/screenshots/ask-sample.png)

![The same answer read backwards: the cited records outlined in red in the evidence graph, the picked record open beside it with the text that went into the prompt, and the retrieved records listed with their scores](docs/screenshots/ask-evidence-sample.png)

More screenshots and what every view does: [docs/features.md](docs/features.md).

## Try it

```sh
npm install
npm run dev          # http://127.0.0.1:5173
```

Click **Open the sample dataset**, or drop your GraphRAG `output/` folder onto the page. Live demo
with the sample: https://workdd.github.io/graphrag-inspector/

To work with your own graph every day, put its files under `local-data/<name>/` (ignored by Git,
served only by the dev server) and open `?data=./data/<name>`. Any folder served over HTTP works the
same way. [docs/formats.md](docs/formats.md) covers the built copy, the standalone server and the
Docker image.

## What it reads

| Input | Needs |
| --- | --- |
| **GraphRAG output**, 0.3 to 2.x | `entities.parquet` and `relationships.parquet`. Communities, reports, text units, documents and claims are each used when present. |
| **A plain graph** | `nodes.csv` and `edges.csv`, or just the edge table with its ends taken as the nodes. Column names are guessed from the usual ones, and what was guessed is reported. |
| **Apache AGE exports** | The same layout as GraphRAG output. |

Without communities, only the entity list and the neighbourhood graphs are available until you have
them found here. Local search and the embedding space need entity vectors; the Ask tab can build
them through your provider, or `tools/embed_index` writes them to a file.

Every file name, version difference and level-numbering rule: [docs/formats.md](docs/formats.md).

Size: 50,000 entities and 202,979 relationships open in 561 ms, find their communities in 2.5 s,
and every view draws in under five seconds, with a peak heap of 386 MB. The exception is asking for
one node per record (**Show: all of the data** with **Arrange: free**), which does not finish above
about a thousand entities. [bench/browser.md](bench/browser.md) has the table and
[bench/](bench/README.md) regenerates it.

## Ask a question

The **Ask** tab answers from the graph you have open, using a model provider you configure. It
follows GraphRAG's two search methods. **The selection and the budgeting are this project's own, so
an answer here is not guaranteed to match what `graphrag query` returns from the same index** —
[issue #12](https://github.com/workdd/graphrag-inspector/issues/12) tracks what that costs.

- **Local** embeds the question, ranks entities by cosine, and packs the seeds, their relationships,
  the reports of their communities, the source chunks and the claims into a token budget.
- **Global** reads the community reports in windows, asks the model for scored points from each, and
  asks once more for the answer. No embeddings, which is how GraphRAG's global search works too.

Any OpenAI-compatible endpoint will do. The key lives in your browser's local storage, never in a
saved run and never in a log line.

What comes back is meant to be checked rather than believed: every citation opens its record, the
evidence graph outlines what was cited inside what was sent, the retrieved-and-ignored records stay
listed with their scores, and **Save this run** writes a trace a colleague can open with no key at
all. The whole of it: [docs/search.md](docs/search.md).

## Development

```sh
npm run typecheck
npm test             # vitest: loaders, hierarchy, metrics, map model, evidence, search
npm run e2e          # Playwright against the production build
npm run build        # vite build, then scripts/check-dist.mjs
npm run hooks        # installs the pre-push check once per clone
```

Two checks keep private data and credentials out of the open. `scripts/check-sensitive.sh` runs
before every push and refuses data files outside `public/samples/`, environment files and
identifiers that only occur in private exports; `scripts/check-dist.mjs` fails a build that would
publish anything but the sample, or an API key inlined from the environment. Real graphs belong in
`local-data/`, which Git ignores and the build never copies.

Offline tools live in [tools/](tools/README.md): the entity-embedding sidecar, an Apache AGE export,
a Leiden re-clustering run, community summaries and a partition comparison.

[CONTRIBUTING.md](CONTRIBUTING.md) is the workflow; [CHANGELOG.md](CHANGELOG.md) is the releases.

## Come and help

**Issues and pull requests are welcome, and so is everything in between.** A screenshot of a graph
that looks wrong, a GraphRAG version that will not load, a sentence in the interface that reads
badly. You do not have to bring a fix with the report, and you do not have to be sure it is a bug.

**Korean and English are both fine**, in issues, pull requests, commits and review.
한국어로 편하게 남기셔도 됩니다. The
[good first issue](https://github.com/workdd/graphrag-inspector/labels/good%20first%20issue) label
is scoped small on purpose.

What would help most right now: **a graph that does not load, or loads wrongly** (the version that
produced it tells us more than a stack trace does, and never attach a real index —
[SECURITY.md](SECURITY.md) says what to keep out); **whether the Health findings are true of your
graph** (the thresholds are named in `src/core/metrics/diagnosis.ts` with the reason each sits where
it does); and **anything the interface says badly**, in either language.

## License

MIT. This project started as a fork of
[GraphRAG Visualizer](https://github.com/noworneverev/graphrag-visualizer); see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The forked code lives on the `legacy-prototype`
branch and is not used by the current application.

한국어 문서는 [README.ko.md](README.ko.md) 에 있습니다.
