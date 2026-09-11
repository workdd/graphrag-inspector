# Measured ceiling

Regenerate with `npm run bench`.

edge factor 4, mix 0.35, one run per size, node v26.0.0

| entities |    rels | CSV MB |  parse |  build |  leiden | quality |  diag |   total | heap MB | levels | communities |    Q |
|----------|---------|--------|--------|--------|---------|---------|-------|---------|---------|--------|-------------|------|
|    1,000 |   4,011 |    0.2 |  11 ms |  10 ms |   30 ms |    3 ms |  1 ms |   55 ms |      18 |      4 |         361 | 0.56 |
|    5,000 |  20,263 |    0.8 |  14 ms |  31 ms |   81 ms |   12 ms |  3 ms |  141 ms |      58 |      5 |       1,670 | 0.61 |
|   10,000 |  40,527 |    1.7 |  15 ms |  49 ms |  160 ms |   24 ms |  6 ms |  254 ms |      65 |      5 |       3,262 | 0.62 |
|   25,000 | 101,423 |    4.3 |  55 ms | 119 ms |  461 ms |   75 ms | 18 ms |  728 ms |     135 |      6 |       8,137 | 0.62 |
|   50,000 | 202,979 |    8.9 | 131 ms | 233 ms | 1150 ms |  334 ms | 63 ms | 1911 ms |     256 |      6 |      16,149 | 0.62 |
