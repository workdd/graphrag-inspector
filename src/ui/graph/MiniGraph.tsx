// The record's neighbourhood drawn in the side column, so a click in a table or a chart shows where
// the record sits without leaving the page. A node click moves the centre here; the graph tab is for
// when this is not enough.
import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { peekGraph } from "../../core/graph/peek";
import { displayTitle, typeColors } from "../../core/graph/palette";
import type { Dataset } from "../../core/model";
import { fmt } from "../format";
import { useT } from "../i18n";

interface Props {
  dataset: Dataset;
  entityId: string;
  /** Moves the centre to another record, staying on this page. */
  onCenter: (id: string) => void;
}

const CAP = 40;

const STYLE: cytoscape.StylesheetJson = [
  { selector: "node", style: { "background-color": "data(color)", width: "data(size)", height: "data(size)", label: "data(label)", "font-size": 10, color: "#1b2430", "text-valign": "bottom", "text-margin-y": 3, "text-max-width": "90px", "text-wrap": "ellipsis", "text-background-color": "#ffffff", "text-background-opacity": 0.75, "text-background-padding": "1px" } },
  { selector: "node.seed", style: { "border-width": 3, "border-color": "#3d5afe", "font-weight": "bold", "font-size": 11 } },
  { selector: "node.bundle", style: { shape: "round-rectangle", "background-opacity": 0.85, "text-valign": "center", "text-halign": "center", "text-margin-y": 0, color: "#ffffff", "font-weight": "bold", "text-background-opacity": 0, width: "label", height: 22, padding: "6px", "text-max-width": "220px", "text-wrap": "none" } },
  { selector: "node.bundle.open", style: { "border-width": 2, "border-color": "#1b2430" } },
  { selector: "node.far", style: { opacity: 0.75, "font-size": 9 } },
  { selector: "edge", style: { width: "data(width)", "line-color": "#c3c9c0", "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#c3c9c0", "arrow-scale": 0.7 } },
  { selector: "edge.hover", style: { label: "data(label)", "font-size": 9, color: "#56626f", "text-rotation": "autorotate", "line-color": "#8a94a0", "target-arrow-color": "#8a94a0" } },
  { selector: "node.hover", style: { "border-width": 2, "border-color": "#8a94a0" } },
];

export function MiniGraph({ dataset, entityId, onCenter }: Props) {
  const { t } = useT();
  const [hops, setHops] = useState(1);
  const [openBundle, setOpenBundle] = useState<string | null>(null);
  // Bigger is the same graph with room to read it, over the page; nothing else changes.
  const [big, setBig] = useState(false);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const colors = useMemo(() => typeColors([...dataset.entities.values()].map((e) => e.type)), [dataset]);
  const peek = useMemo(() => peekGraph(dataset, entityId, hops, CAP), [dataset, entityId, hops]);
  useEffect(() => setOpenBundle(null), [peek]);
  // Callbacks change on every render of the parent; the graph should not be rebuilt for that.
  const center = useRef(onCenter);
  center.current = onCenter;

  useEffect(() => {
    if (!host.current || !peek) return;
    const degree = new Map<string, number>();
    for (const e of peek.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const cy = cytoscape({
      container: host.current,
      style: STYLE,
      minZoom: 0.2,
      maxZoom: 3,
      boxSelectionEnabled: false,
      autounselectify: true,
      elements: [
        ...peek.nodes.map((n) => {
          if (n.bundle) {
            return {
              data: { id: n.id, label: `${n.bundle.type} ×${n.bundle.ids.length}`, color: colors.get(n.bundle.type) ?? "#8a94a0", size: 22, hop: 1, type: n.bundle.type },
              classes: "bundle",
            };
          }
          const e = dataset.entities.get(n.id)!;
          return {
            data: { id: n.id, label: displayTitle(e), color: colors.get(e.type) ?? "#8a94a0", size: n.hop === 0 ? 26 : 12 + 3 * Math.sqrt(degree.get(n.id) ?? 0), hop: n.hop, type: e.type },
            classes: n.hop === 0 ? "seed" : n.hop > 1 ? "far" : "",
          };
        }),
        ...peek.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.count > 1 ? `${e.type} ×${e.count}` : e.type, width: Math.min(5, 1 + Math.log2(e.count)) } })),
      ],
      layout: {
        name: "concentric",
        concentric: (node: cytoscape.NodeSingular) => 10 - Number(node.data("hop")),
        levelWidth: () => 1,
        minNodeSpacing: 18,
        animate: false,
      } as cytoscape.LayoutOptions,
    });
    cyRef.current = cy;
    if (import.meta.env.DEV) (window as unknown as { __cyMini?: cytoscape.Core }).__cyMini = cy;
    cy.fit(undefined, 16);
    if (cy.zoom() > 1.6) { cy.zoom(1.6); cy.center(); }
    cy.on("mouseover", "edge", (ev) => ev.target.addClass("hover"));
    cy.on("mouseout", "edge", (ev) => ev.target.removeClass("hover"));
    cy.on("mouseover", "node", (ev) => ev.target.addClass("hover"));
    cy.on("mouseout", "node", (ev) => ev.target.removeClass("hover"));
    cy.on("tap", "node", (ev) => {
      const id = ev.target.id();
      if (ev.target.hasClass("bundle")) {
        setOpenBundle((open) => (open === id ? null : id));
        cy.nodes(".bundle").removeClass("open");
        ev.target.toggleClass("open");
      } else if (id !== entityId) center.current(id);
    });
    return () => { cy.destroy(); cyRef.current = null; };
  }, [peek, dataset, colors, entityId]);

  // The canvas changes size with the mode, so the graph is measured and fitted again.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.resize();
    // With room to spare the names can be read whole.
    cy.style().selector("node").style("text-max-width", big ? "240px" : "90px").update();
    cy.fit(undefined, big ? 40 : 16);
    if (cy.zoom() > (big ? 2 : 1.6)) { cy.zoom(big ? 2 : 1.6); cy.center(); }
  }, [big, peek]);
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBig(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);

  if (!peek) return null;
  const types = [...new Set(peek.nodes.map((n) => n.bundle?.type ?? dataset.entities.get(n.id)!.type))].sort();
  const bundle = openBundle ? peek.nodes.find((n) => n.id === openBundle)?.bundle : undefined;
  const hidden = peek.hidden.reduce((s, n) => s + n, 0);
  return (
    <>
    {big ? <div className="mini-backdrop" onClick={() => setBig(false)} /> : null}
    <div className={`mini-graph${big ? " big" : ""}`} role={big ? "dialog" : undefined} aria-modal={big || undefined} aria-label={big ? t("Neighbourhood of this record") : undefined}>
      <div className="mini-head">
        <span className="segmented" role="group" aria-label={t("Hops")}>
          {[1, 2].map((h) => (
            <button key={h} className={h === hops ? "active" : undefined} aria-pressed={h === hops} onClick={() => setHops(h)}>{t("{n} hop", { n: h })}</button>
          ))}
        </span>
        <span className="muted">{t("{n} records drawn", { n: fmt(peek.nodes.length) })}{hidden ? ` · ${t("{n} more not drawn", { n: fmt(hidden) })}` : ""}</span>
        {big ? <b className="mini-title">{displayTitle(dataset.entities.get(entityId)!)}</b> : null}
        <button className="btn small" onClick={() => setBig((b) => !b)}>{big ? t("Close (Esc)") : t("View larger")}</button>
      </div>
      <div ref={host} className="mini-canvas" role="img" aria-label={t("Neighbourhood of this record")} />
      {bundle ? (
        <div className="mini-bundle">
          <p className="muted">{t("{type} linked by {rel}: {n}. Pick one to move the centre.", { type: bundle.type, rel: bundle.relationship, n: fmt(bundle.ids.length) })}</p>
          <div className="chips">
            {bundle.ids.slice(0, 60).map((id) => (
              <button key={id} className="chip" onClick={() => onCenter(id)}>{displayTitle(dataset.entities.get(id)!)}</button>
            ))}
            {bundle.ids.length > 60 ? <span className="muted">{t("and {count} more", { count: fmt(bundle.ids.length - 60) })}</span> : null}
          </div>
        </div>
      ) : null}
      <div className="mini-legend">
        {types.map((ty) => <span key={ty}><i style={{ background: colors.get(ty) }} />{ty}</span>)}
      </div>
      <p className="muted mini-hint">{t("Click a record to move the centre here, a group to list its records. Hover a line for its relationship.")}</p>
    </div>
    </>
  );
}
