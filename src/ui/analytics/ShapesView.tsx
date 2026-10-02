// Rules the data almost keeps, read from the data itself, with the records that break each one.
// The rule is a proposal; the breaking records are what the reader goes and checks.
import { useMemo, useState } from "react";
import { inferRules, structureChecks, type ShapeRule, type StructureKind } from "../../core/metrics/shapes";
import type { Dataset } from "../../core/model";
import { displayTitle } from "../../core/graph/palette";
import { downloadText, toCsv } from "../download";
import { fmt, pct } from "../format";
import { useT } from "../i18n";
import "./analytics.css";

interface Props {
  dataset: Dataset;
  onOpenEntity: (id: string) => void;
}

const STRUCTURE: Record<StructureKind, { title: string; why: string }> = {
  duplicate: { title: "Same relationship recorded twice", why: "Two links with the same ends and the same name. Counts and weights read double." },
  "self-loop": { title: "Record linked to itself", why: "Usually a join that matched a row with itself." },
  "overloaded-name": { title: "One relationship name for many type pairs", why: "A query on this name returns pairs it did not mean; splitting the name keeps the meaning." },
  untyped: { title: "Record without a type", why: "It belongs to no type, so no rule and no type filter reaches it." },
};

function sentence(rule: ShapeRule, t: (k: string, v?: Record<string, string | number>) => string) {
  const p = rule.profile;
  const vars = { focus: p.focusType, rel: p.relType, other: p.otherType };
  if (rule.kind === "required") {
    return p.direction === "out" ? t("Every {focus} has a {rel} link to a {other}", vars) : t("Every {focus} is the target of a {rel} link from a {other}", vars);
  }
  return p.direction === "out" ? t("A {focus} has at most one {rel} link to a {other}", vars) : t("A {focus} is the target of at most one {rel} link from a {other}", vars);
}

export function ShapesView({ dataset, onOpenEntity }: Props) {
  const { t } = useT();
  const [support, setSupport] = useState(0.9);
  const [onlyBroken, setOnlyBroken] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const rules = useMemo(() => inferRules(dataset, { support }), [dataset, support]);
  const structure = useMemo(() => structureChecks(dataset), [dataset]);
  const shown = onlyBroken ? rules.filter((r) => r.violators.length > 0) : rules;
  const broken = rules.filter((r) => r.violators.length > 0).length;
  const title = (id: string) => { const e = dataset.entities.get(id); return e ? displayTitle(e) : id; };
  const ruleKey = (r: ShapeRule) => `${r.kind}|${r.profile.focusType}|${r.profile.relType}|${r.profile.otherType}|${r.profile.direction}`;
  const csv = () => downloadText("shape-violations.csv", toCsv([
    ["rule", "kind", "pass_rate", "record", "type"],
    ...rules.flatMap((r) => r.violators.map((id) => [sentence(r, t), r.kind, r.passRate.toFixed(4), title(id), r.profile.focusType])),
  ]), "text/csv;charset=utf-8");

  return (
    <div className="analytics shapes">
      <section className="kpis">
        <div><b>{fmt(rules.length)}</b><span>{t("rules proposed")}</span></div>
        <div><b>{fmt(broken)}</b><span>{t("broken by some records")}</span></div>
        <div><b>{fmt(rules.reduce((s, r) => s + r.violators.length, 0))}</b><span>{t("breaking records")}</span></div>
        <div><b>{fmt(structure.length)}</b><span>{t("structural findings")}</span></div>
      </section>

      {structure.length ? (
        <section>
          <h3>{t("Structure")}</h3>
          <ul className="structure-list">
            {structure.map((f) => (
              <li key={`${f.kind}-${f.examples[0]}`}>
                <b>{t(STRUCTURE[f.kind].title)}</b> <span className="count">{fmt(f.count)}</span>
                <p className="muted">{t(STRUCTURE[f.kind].why)}</p>
                {f.kind === "overloaded-name" ? (
                  <p className="pairs"><code>{f.examples[0]}</code>: {f.pairs!.join(" · ")}</p>
                ) : (
                  <div className="chips">{f.examples.map((id) => <button key={id} className="chip" onClick={() => onOpenEntity(id)}>{title(id)}</button>)}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="table-head">
          <h3>{t("Relationship rules read from the data")}</h3>
          <label className="control">{t("Propose at")}
            <select value={support} onChange={(e) => setSupport(Number(e.target.value))}>
              {[0.8, 0.9, 0.95, 0.99].map((s) => <option key={s} value={s}>{pct(s)}</option>)}
            </select>
          </label>
          <label className="control"><input type="checkbox" checked={onlyBroken} onChange={(e) => setOnlyBroken(e.target.checked)} /> {t("Only broken rules")}</label>
          <button className="btn" onClick={csv} disabled={!broken}>{t("Download CSV")}</button>
        </div>
        <p className="muted">{t("A rule is proposed when that share of a type keeps it, like a SHACL minCount 1 or maxCount 1. The records that break it are listed first, nearest to holding on top: those are the likeliest gaps in the data.")}</p>
        <table className="ctable shape-table">
          <thead>
            <tr><th>{t("Rule")}</th><th className="num">{t("Keeps")}</th><th className="num">{t("Pass rate")}</th><th className="num">{t("Breaks")}</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const k = ruleKey(r);
              const isOpen = open === k;
              return [
                <tr key={k} tabIndex={0} className={isOpen ? "open" : undefined} onClick={() => setOpen(isOpen ? null : k)} onKeyDown={(e) => e.key === "Enter" && setOpen(isOpen ? null : k)} aria-expanded={isOpen}>
                  <td>
                    <span className={`rule-kind ${r.kind}`}>{r.kind === "required" ? t("required") : t("at most one")}</span> {sentence(r, t)}
                  </td>
                  <td className="num">{fmt(r.kept)} / {fmt(r.scope)}</td>
                  <td className="num pass-cell">
                    <span className="pass-bar"><span style={{ width: `${r.passRate * 100}%` }} /></span>
                    {(r.passRate * 100).toFixed(1)}%
                  </td>
                  <td className="num">{r.violators.length ? fmt(r.violators.length) : "—"}</td>
                </tr>,
                isOpen ? (
                  <tr key={`${k}-v`} className="violators">
                    <td colSpan={4}>
                      {r.violators.length ? (
                        <div className="chips">
                          {r.violators.slice(0, 200).map((id) => (
                            <button key={id} className="chip" onClick={() => onOpenEntity(id)}>
                              {title(id)}{r.kind === "single" ? <b> ×{r.profile.counts.get(id)}</b> : null}
                            </button>
                          ))}
                          {r.violators.length > 200 ? <span className="muted">{t("and {n} more in the CSV", { n: fmt(r.violators.length - 200) })}</span> : null}
                        </div>
                      ) : <span className="muted">{t("Every record keeps this rule.")}</span>}
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="muted">{onlyBroken ? t("No proposed rule is broken at this share.") : t("No rule reaches this share.")}</p> : null}
      </section>
    </div>
  );
}
