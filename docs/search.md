# Asking a question

How the two searches work, what they need, and how to read what comes back.
[README.md](../README.md#ask-a-question) has the short version.


## The two methods

The **Ask** tab answers from the index you have open, using a model provider you configure. It
follows GraphRAG's two search methods; the selection and the budgeting are this project's own, so an
answer here is not guaranteed to match what `graphrag query` returns from the same index.

- **Local** embeds the question, ranks entities by cosine against the entity vectors, and packs the
  seeds, the relationships between them, the reports of the communities they belong to, the source
  chunks behind them and the claims about them into a token budget, in that order of priority. It
  needs an `embeddings.parquet` beside the index.
- **Global** reads the community reports, splits them into context windows, asks the model for
  scored points from each window, keeps the best of them and asks once more for the answer. It needs
  `community_reports.parquet` and no embeddings, which is how GraphRAG's global search works too.

## Reading a run before you configure anything

Before configuring anything, you can read a run that was recorded earlier. The shipped sample
carries one, and the tab offers it as **See a saved run**: a real answer, with its citations, its
evidence graph and the records it passed over, all resolving against the index in front of you. Drop
an `example-run.json` next to your own index and it does the same there; **Save this run** writes
the file.

## Provider settings

Any OpenAI-compatible endpoint will do. The key lives in your browser's local storage, never in a
saved run and never in a log line. Presets for Upstage and OpenAI fill in the two model names; the
embedding model matters, because a question embedded with a different model than the sidecar was
built with ranks nothing usefully.

To skip typing the settings in every browser, copy `.env.example` to `.env.development.local` and
set `VITE_LLM_BASE_URL`, `VITE_LLM_CHAT_MODEL`, `VITE_LLM_EMBED_MODEL` and, if you accept the
consequence, `VITE_LLM_API_KEY`. Vite inlines those into the bundle, so `npm run build` refuses to
publish a key unless `ALLOW_EMBEDDED_KEY=1` says it may. Anything typed in the app wins over the
environment.

## Entity vectors

Local search needs entity vectors, which GraphRAG writes to a vector store rather than to Parquet.
**The Ask tab can build them for you**, through the provider you have already configured: it says how
many entities and how many requests before it starts, it can be stopped, and the vectors stay in that
browser and are reused the next time you open the same index. Nothing else is needed for a local
search.

To build them once and carry them between machines, `tools/embed_index` writes the same vectors to a
file:

```sh
EMBED_API_KEY=… python3 tools/embed_index/embed_index.py --index ~/graphrag/output
```

It writes `embeddings.parquet` next to the index: one row per entity, the vector as fixed-length
binary, and the model, the dimension and a SHA-256 of every source file in the file's metadata. The
app checks those fingerprints and turns local search off, saying which file changed, when the
sidecar was made from a different index.

## Checking the answer

What comes back is meant to be checked rather than believed:

- Every citation in the answer is a button. Picking one reads that record beside the answer, with
  the exact text that went into the prompt, the links the run carried and the source text behind it.
- The evidence graph draws the records that were sent to the model and outlines in red the ones the
  answer actually cited. A node, a citation and a table row are three views of the same record, and
  picking any of them reads it in place. Nothing sends you to another tab.
- The table under the graph lists everything that was retrieved with its score, so the records the
  model was given and ignored are as visible as the ones it used.
- The embedding space plots the question and the entity vectors, reduced with PCA, in two or three
  dimensions, marking what went into the prompt and what the budget cut. It says on the screen that
  distance there is not the cosine the search used.
- **How a question reaches an answer** draws the run itself: retrieval, context window, model call
  and response, with the counts and milliseconds this run actually spent, and the calls that left
  the browser bordered in red. **Show the prompt sent to the model** prints the messages verbatim.
- **Save this run** writes a trace file (question, settings without the key, every context record,
  the answer and the timings); **Open a trace** reads one back and relinks its citations, so a run
  can be reviewed on a machine with no key at all.

Example questions are offered from the data itself: entities that are actually reachable, named with
their schema type, weighted towards the kinds of record people ask impact questions about.

