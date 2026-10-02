// Five measures of where a record sits, each shown over every record before any one is ranked, so a
// top score can be read as an outlier or as one of many. A point, a bar or a row opens the record.
import { useEffect, useMemo, useState } from "react";
import { centrality, distribution, ranking, METRICS, type Centrality, type MetricKey } from "../../core/metrics/centrality";
import type { Dataset } from "../../core/model";
import { displayTitle } from "../../core/graph/palette";
import { downloadText, toCsv } from "../download";
import { fmt } from "../format";
import { useT } from "../i18n";
import "./analytics.css";

interface Props {
  dataset: Dataset;
  onOpenEntity: (id: string) => void;
}

const LABEL: Record<MetricKey, string> = {
  pagerank: "PageRank",
  betweenness: "Betweenness",
  degree: "Degree",
  closeness: "Closeness",
  clustering: "Clustering",
};
const MEANING: Record<MetricKey, string> = {
  pagerank: "Influence along the arrows: pointed at by records that are themselves pointed at",
  betweenness: "Bridging: share of shortest paths between other records that pass through it",
  degree: "Distinct records it is linked to",
  closeness: "Reach: mean of 1 / distance to every other record (harmonic, so a graph in pieces still works)",
  clustering: "Local density: share of its neighbour pairs that are linked to each other",
};

const num = (v: number, metric: MetricKey) =>
  metric === "degree" ? fmt(v) : v === 0 ? "0" : v < 0.001 ? v.toExponential(2) : v.toFixed(metric === "pagerank" ? 4 : 3);

function Histogram({ values, metric, active, log, onPick }: { values: Float64Array; metric: MetricKey; active: boolean; log: boolean; onPick: () => void }) {
  const { t } = useT();
  const d = useMemo(() => distribution(values), [values]);
  const W = 200, H = 64;
  const scale = (c: number) => (log ? Math.log10(c + 1) : c);
  const top = Math.max(1, ...d.counts.map(scale));
  const bw = W / d.counts.length;
  return (
    <button className={`metric-tile${active ? " active" : ""}`} onClick={onPick} aria-pressed={active} title={t(MEANING[metric])}>
      <span className="metric-name">{t(LABEL[metric])}</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="metric-hist" role="img" aria-label={t("{metric} across {n} records", { metric: t(LABEL[metric]), n: fmt(values.length) })}>
        {d.counts.map((c, i) => {
          const h = c ? Math.max(1.5, (scale(c) / top) * (H - 4)) : 0;
          return <rect key={i} x={i * bw + 0.5} y={H - h} width={bw - 1} height={h}><title>{fmt(c)}</title></rect>;
        })}
      </svg>
      <span className="metric-stats">
        {t("median ≈ {m}", { m: num(d.median, metric) })} · {t("p90 ≈ {p}", { p: num(d.p90, metric) })} · {t("max {x}", { x: num(d.max, metric) })}
      </span>
    </button>
  );
}

function RankChart({ c, metric, order, log, onOpen, name }: { c: Centrality; metric: MetricKey; order: number[]; log: boolean; onOpen: (id: string) => void; name: (i: number) => string }) {
  const { t } = useT();
  const W = 900, H = 200, PAD = 54;
  // Thousands of points read as a line anyway; keep the leaders whole and thin the tail evenly.
  const shown = useMemo(() => {
    if (order.length <= 1500) return order.map((i, r) => ({ i, r }));
    const head = order.slice(0, 500).map((i, r) => ({ i, r }));
    const step = (order.length - 500) / 1000;
    const tail = Array.from({ length: 1000 }, (_, k) => { const r = 500 + Math.floor(k * step); return { i: order[r]!, r }; });
    return [...head, ...tail];
  }, [order]);
  const v = c.values[metric];
  const max = order.length ? v[order[0]!]! || 1 : 1;
  // A heavy tail squeezes the leaders against the axis; a log rank axis gives them room.
  const span = log ? Math.log10(order.length) || 1 : Math.max(1, order.length - 1);
  const x = (r: number) => PAD + ((log ? Math.log10(r + 1) : r) / span) * (W - PAD - 8);
  const y = (val: number) => H - 18 - (val / max) * (H - 30);
  const path = shown.map(({ i, r }, k) => `${k ? "L" : "M"}${x(r).toFixed(1)},${y(v[i]!).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rank-chart" role="img" aria-label={t("{metric} by rank", { metric: t(LABEL[metric]) })}>
      <line x1={PAD} y1={H - 18} x2={W - 8} y2={H - 18} className="axis" />
      <line x1={PAD} y1={12} x2={PAD} y2={H - 18} className="axis" />
      <text x={PAD - 4} y={16} className="tick" textAnchor="end">{num(max, metric)}</text>
      <text x={PAD - 4} y={H - 18} className="tick" textAnchor="end">0</text>
      <text x={PAD} y={H - 4} className="tick">1</text>
      <text x={W - 8} y={H - 4} className="tick" textAnchor="end">{fmt(order.length)}</text>
      <path d={path} className="rank-line" />
      {shown.slice(0, 30).map(({ i, r }) => (
        <circle key={i} cx={x(r)} cy={y(v[i]!)} r={4} className="rank-dot" onClick={() => onOpen(c.ids[i]!)}>
          <title>{`#${r + 1} ${name(i)} · ${num(v[i]!, metric)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function CentralityView({ dataset, onOpenEntity }: Props) {
  const { t } = useT();
  // A few thousand breadth-first searches block for a moment, so the page paints first.
  const [c, setC] = useState<Centrality | null>(null);
  useEffect(() => {
    setC(null);
    const timer = window.setTimeout(() => setC(centrality(dataset)), 30);
    return () => window.clearTimeout(timer);
  }, [dataset]);
  const [metric, setMetric] = useState<MetricKey>("pagerank");
  const [log, setLog] = useState(true);
  const [type, setType] = useState("");
  const [top, setTop] = useState(25);
  const types = useMemo(() => [...new Set([...dataset.entities.values()].map((e) => e.type))].sort(), [dataset]);
  const entityAt = (i: number) => dataset.entities.get(c!.ids[i]!)!;
  const name = (i: number) => displayTitle(entityAt(i));
  const order = useMemo(() => (c ? ranking(c, metric, type ? (i) => dataset.entities.get(c.ids[i]!)!.type === type : undefined) : []), [c, metric, type, dataset]);

  if (!c) return <div className="view-loading">{t("Measuring {n} records…", { n: fmt(dataset.entities.size) })}</div>;

  const maxOf = Object.fromEntries(METRICS.map((m) => [m, Math.max(...c.values[m]) || 1])) as Record<MetricKey, number>;
  const rows = order.slice(0, top);
  const csv = () => downloadText("centrality.csv", toCsv([
    ["name", "type", ...METRICS],
    ...order.map((i) => [name(i), entityAt(i).type, ...METRICS.map((m) => c.values[m][i]!)]),
  ]), "text/csv;charset=utf-8");

  return (
    <div className="analytics">
      <section className="kpis">
        <div><b>{fmt(c.ids.length)}</b><span>{t("records")}</span></div>
        <div><b>{fmt(c.links)}</b><span>{t("distinct links")}</span></div>
        <div><b>{fmt(dataset.relationships.length)}</b><span>{t("relationships")}</span></div>
        <div>
          <b>{c.estimated ? t("estimate") : t("exact")}</b>
          <span>{c.estimated ? t("betweenness and closeness from {k} sampled sources", { k: fmt(c.pivots) }) : t("every record searched")}</span>
        </div>
      </section>

      <section>
        <div className="table-head">
          <h3>{t("Distribution over every record")}</h3>
          <label className="control"><input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> {t("Log scale")}</label>
        </div>
        <div className="metric-strip">
          {METRICS.map((m) => <Histogram key={m} values={c.values[m]} metric={m} active={m === metric} log={log} onPick={() => setMetric(m)} />)}
        </div>
        <p className="muted">{t(MEANING[metric])}. {t("Median and p90 are interpolated. Pick a tile to rank by it.")}</p>
      </section>

      <section>
        <div className="table-head">
          <h3>{t("{metric} by rank", { metric: t(LABEL[metric]) })}</h3>
          <label className="control">{t("Type")}
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t("all types")}</option>
              {types.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
            </select>
          </label>
        </div>
        <RankChart c={c} metric={metric} order={order} log={log} onOpen={onOpenEntity} name={name} />
        <p className="muted">{t("Scores are measured on the whole graph; the type only filters what is ranked. The first 30 points open their record.")}</p>
      </section>

      <section>
        <div className="table-head">
          <h3>{t("Top {n}", { n: Math.min(top, order.length) })}</h3>
          <label className="control">{t("Show")}
            <select value={top} onChange={(e) => setTop(Number(e.target.value))}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn" onClick={csv}>{t("Download CSV")}</button>
        </div>
        <table className="ctable rank-table">
          <thead>
            <tr>
              <th className="num">#</th><th className="pad-left">{t("Record")}</th><th>{t("Type")}</th>
              {METRICS.map((m) => <th key={m} className={m === metric ? "num sorted" : "num"} title={t(MEANING[m])}>{t(LABEL[m])}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((i, r) => (
              <tr key={c.ids[i]} tabIndex={0} onClick={() => onOpenEntity(c.ids[i]!)} onKeyDown={(e) => e.key === "Enter" && onOpenEntity(c.ids[i]!)}>
                <td className="num">{r + 1}</td>
                <td className="title" title={name(i)}>{name(i)}</td>
                <td>{entityAt(i).type}</td>
                {METRICS.map((m) => (
                  <td key={m} className="num bar-cell">
                    <span className="mini-bar" style={{ width: `${(c.values[m][i]! / maxOf[m]) * 100}%` }} />
                    <span className="bar-num">{num(c.values[m][i]!, m)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
