# Measured ceiling

Regenerate with `npm run bench`.

edge factor 4, mix 0.35, one run per size, node v26.0.0

| entities |    rels | CSV MB |  parse |   build |  leiden | quality |   diag |   total | heap MB | levels | communities |    Q |
|----------|---------|--------|--------|---------|---------|---------|--------|---------|---------|--------|-------------|------|
|   10,000 |  40,527 |    1.7 |  49 ms |   95 ms |  201 ms |   31 ms |  10 ms |  386 ms |      89 |      5 |       3,262 | 0.62 |
|   50,000 | 202,979 |    8.9 | 133 ms | 1292 ms | 1499 ms |  202 ms |  56 ms | 3182 ms |     230 |      6 |      16,149 | 0.62 |
|  100,000 | 405,706 |   18.2 | 607 ms | 2107 ms | 4083 ms |  544 ms | 186 ms | 7527 ms |     430 |      6 |      31,717 | 0.63 |
