"use client";
import { useMemo, useRef, useState } from "react";
import {
  Network,
  ZoomIn,
  ZoomOut,
  Move,
  BookOpen,
  ArrowRight,
  Check,
} from "lucide-react";
import { Badge, Button, Empty, PageTitle } from "./shared";
import {
  useIntelligence,
  useIntelligenceActions,
  ReferenceLinks,
} from "./intelligence-shared";
export function KnowledgeMap({
  initialConcept,
}: {
  initialConcept: string | null;
}) {
  const [selected, setSelected] = useState(initialConcept ?? "pki"),
    [view, setView] = useState<"map" | "list">("map"),
    [filter, setFilter] = useState(""),
    [domain, setDomain] = useState(""),
    [focused, setFocused] = useState(true),
    [relations, setRelations] = useState(false),
    [zoom, setZoom] = useState(0.65),
    [pan, setPan] = useState({ x: 25, y: 35 }),
    [skips, setSkips] = useState<string[]>([]);
  const drag = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const { data, error, busy, run } = useIntelligence(selected),
    actions = useIntelligenceActions();
  const layout = useMemo(() => {
    if (!data) return { nodes: [], edges: [], width: 700, height: 500 };
    let ids = new Set(data.graph.nodes.map((n) => n.id));
    if (focused) {
      ids = new Set([...data.path.map((p) => p.concept.id), selected]);
      for (const e of data.graph.edges)
        if (e.sourceId === selected || e.targetId === selected) {
          ids.add(e.sourceId);
          ids.add(e.targetId);
        }
    }
    const nodes = data.graph.nodes.filter(
      (n) =>
        ids.has(n.id) &&
        (!filter || n.name.toLowerCase().includes(filter.toLowerCase())) &&
        (!domain || n.objectives.some((o) => o.startsWith(domain + "."))),
    );
    const included = new Set(nodes.map((n) => n.id));
    const edges = data.graph.edges.filter(
      (e) =>
        included.has(e.sourceId) &&
        included.has(e.targetId) &&
        (relations || e.kind === "prerequisite" || e.kind === "builds_on"),
    );
    const depthMemo = new Map<string, number>();
    function depth(id: string): number {
      if (depthMemo.has(id)) return depthMemo.get(id)!;
      const parents = edges.filter(
        (e) =>
          (e.kind === "prerequisite" || e.kind === "builds_on") &&
          e.targetId === id,
      );
      const value = parents.length
        ? 1 + Math.max(...parents.map((e) => depth(e.sourceId)))
        : 0;
      depthMemo.set(id, value);
      return value;
    }
    const columns = new Map<number, number>();
    const positions = nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => {
        const d = depth(n.id),
          row = columns.get(d) ?? 0;
        columns.set(d, row + 1);
        return { ...n, x: d * 225, y: row * 118 };
      });
    return {
      nodes: positions,
      edges,
      width: Math.max(700, ...positions.map((n) => n.x + 210)),
      height: Math.max(380, ...positions.map((n) => n.y + 110)),
    };
  }, [data, selected, focused, filter, domain, relations]);
  if (!data)
    return (
      <section className="panel">
        <p>{error || "Loading the validated learning relationships…"}</p>
      </section>
    );
  const concept = data.graph.nodes.find((n) => n.id === selected),
    performance = data.graph.performances.find((p) => p.id === selected);
  const available = data.availableQuestions.filter((q) =>
    q.conceptIds.includes(selected),
  );
  const notes = data.notes.filter(
    (n) =>
      n.concept_id === selected ||
      data.path.some((p) => p.concept.id === n.concept_id),
  );
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE INTELLIGENCE"
        title="Cybersecurity Knowledge Map"
        description="Follow a foundation to its applications. The arrows show learning recommendations, not official exam prerequisites."
      />
      {error && <div className="alert error">{error}</div>}
      <div className="map-controls">
        <input
          aria-label="Filter knowledge concepts"
          placeholder="Find a concept…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          aria-label="Filter concept domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          <option value="">All domains</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option value={d} key={d}>
              Domain {d}
            </option>
          ))}
        </select>
        <Button
          variant={view === "map" ? "" : "ghost"}
          onClick={() => setView("map")}
        >
          Graph
        </Button>
        <Button
          variant={view === "list" ? "" : "ghost"}
          onClick={() => setView("list")}
        >
          Accessible list
        </Button>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={focused}
            onChange={(e) => setFocused(e.target.checked)}
          />
          Focus on target path
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={relations}
            onChange={(e) => setRelations(e.target.checked)}
          />
          Include related links
        </label>
      </div>
      <div className="knowledge-map-layout">
        <section className="panel map-panel">
          {view === "map" ? (
            <>
              <div className="map-navigation">
                <Button
                  variant="ghost"
                  aria-label="Zoom out"
                  onClick={() => setZoom(Math.max(0.15, zoom - 0.15))}
                >
                  <ZoomOut size={16} />
                </Button>
                <span>{Math.round(zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  aria-label="Zoom in"
                  onClick={() => setZoom(Math.min(2, zoom + 0.15))}
                >
                  <ZoomIn size={16} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setZoom(
                      Math.max(
                        0.15,
                        Math.min(0.85, 680 / layout.width, 440 / layout.height),
                      ),
                    );
                    setPan({ x: 15, y: 25 });
                  }}
                >
                  Fit map
                </Button>
                <small>
                  <Move size={13} />
                  Drag empty space to pan; arrow keys also pan.
                </small>
              </div>
              <svg
                className="concept-map-canvas"
                viewBox="0 0 750 500"
                tabIndex={0}
                role="group"
                aria-label="Interactive concept graph. Prerequisite arrows point toward the advanced concept. Use the accessible list for equivalent navigation."
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowUp",
                      "ArrowDown",
                      "ArrowLeft",
                      "ArrowRight",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    setPan((p) => ({
                      x:
                        p.x +
                        (e.key === "ArrowLeft"
                          ? 30
                          : e.key === "ArrowRight"
                            ? -30
                            : 0),
                      y:
                        p.y +
                        (e.key === "ArrowUp"
                          ? 30
                          : e.key === "ArrowDown"
                            ? -30
                            : 0),
                    }));
                  }
                }}
                onPointerDown={(e) => {
                  if ((e.target as Element).closest("[data-concept]")) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    panX: pan.x,
                    panY: pan.y,
                  };
                }}
                onPointerMove={(e) => {
                  if (drag.current)
                    setPan({
                      x: drag.current.panX + e.clientX - drag.current.x,
                      y: drag.current.panY + e.clientY - drag.current.y,
                    });
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                <defs>
                  <marker
                    id="concept-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0 0 L8 4 L0 8" fill="currentColor" />
                  </marker>
                </defs>
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                  {layout.edges.map((e) => {
                    const a = layout.nodes.find((n) => n.id === e.sourceId)!,
                      b = layout.nodes.find((n) => n.id === e.targetId)!;
                    return (
                      <path
                        key={e.id}
                        className={
                          e.kind === "prerequisite" || e.kind === "builds_on"
                            ? "prerequisite-edge"
                            : "related-edge"
                        }
                        d={`M${a.x + 185},${a.y + 43} C${a.x + 215},${a.y + 43} ${b.x - 30},${b.y + 43} ${b.x},${b.y + 43}`}
                        markerEnd="url(#concept-arrow)"
                      >
                        <title>
                          {a.name} → {b.name}: {e.kind.replaceAll("_", " ")}
                        </title>
                      </path>
                    );
                  })}
                  {layout.nodes.map((n) => {
                    const p = data.graph.performances.find(
                      (p) => p.id === n.id,
                    );
                    const words = n.name.split(" "),
                      lines: string[] = [""];
                    for (const word of words) {
                      if (lines.at(-1)!.length + word.length > 23)
                        lines.push(word);
                      else
                        lines[lines.length - 1] +=
                          (lines.at(-1) ? " " : "") + word;
                    }
                    return (
                      <g
                        key={n.id}
                        data-concept={n.id}
                        className={`concept-node ${selected === n.id ? "selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${n.name}. ${p?.status ?? "Not studied"}. Open concept lesson.`}
                        transform={`translate(${n.x} ${n.y})`}
                        onClick={() => setSelected(n.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected(n.id);
                          }
                        }}
                      >
                        <rect width="185" height="94" rx="10" />
                        <circle
                          cx="15"
                          cy="18"
                          r="4"
                          className={
                            p?.mastery === null
                              ? "unknown-status"
                              : "studied-status"
                          }
                        />
                        {lines.slice(0, 2).map((line, i) => (
                          <text
                            key={i}
                            x="15"
                            y={38 + i * 16}
                            className="concept-node-name"
                          >
                            {line}
                          </text>
                        ))}
                        <text x="15" y="80" className="concept-node-state">
                          {p?.status ?? "Not studied"}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
              <p className="fine-print">
                Solid arrows: prerequisite/builds upon. Dashed links: related,
                commonly confused, or next-topic suggestions. Every node has a
                text status.
              </p>
            </>
          ) : (
            <div className="concept-accessible-list">
              {layout.nodes.map((n) => {
                const p = data.graph.performances.find((p) => p.id === n.id);
                return (
                  <button
                    key={n.id}
                    className={selected === n.id ? "selected" : ""}
                    onClick={() => setSelected(n.id)}
                  >
                    <Network size={16} />
                    <span>
                      <strong>{n.name}</strong>
                      <small>
                        Objectives {n.objectives.join(", ")} ·{" "}
                        {p?.status ?? "Not studied"}
                      </small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
            </div>
          )}
          {!layout.nodes.length && (
            <Empty title="No matching concepts">
              Broaden the domain or text filter.
            </Empty>
          )}
        </section>
        <aside className="panel concept-inspector">
          {concept ? (
            <>
              <Badge tone="blue">
                Objectives {concept.objectives.join(", ")}
              </Badge>
              <h2>{concept.name}</h2>
              <Badge
                tone={
                  performance?.mastery === null
                    ? "muted"
                    : performance?.status === "Needs improvement"
                      ? "orange"
                      : "blue"
                }
              >
                {performance?.status ?? "Not studied"}
              </Badge>
              <p className="concept-lead">{concept.definition}</p>
              <h3>How it works</h3>
              <p>{concept.explanation}</p>
              {concept.examples.map((example, i) => (
                <div className="concept-definition" key={example}>
                  <small>EXAMPLE {i + 1}</small>
                  <p>{example}</p>
                </div>
              ))}
              <div className="concept-evidence">
                <strong>
                  {performance?.mastery === null
                    ? "Unknown"
                    : `${performance?.mastery}%`}
                </strong>
                <span>
                  existing evidence-adjusted estimate
                  <br />
                  {performance?.distinctQuestions ?? 0} distinct first
                  encounters · {performance?.delayedReviews ?? 0} delayed
                  reviews
                </span>
              </div>
              <p className="fine-print">
                Last observed:{" "}
                {performance?.lastReviewAt
                  ? new Date(performance.lastReviewAt).toLocaleString()
                  : "No study evidence yet"}
                . A missing score is not demonstrated weakness.
              </p>
              <div className="button-row">
                {available.length > 0 ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(() => actions.practice({ conceptId: selected }))
                    }
                  >
                    Practice {available.length} linked question(s){" "}
                    <ArrowRight size={14} />
                  </Button>
                ) : (
                  <Badge tone="muted">
                    Lesson available · no published questions linked yet
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      actions.save({ kind: "reference", conceptId: selected }),
                    )
                  }
                >
                  <BookOpen size={14} />
                  Create concept note
                </Button>
              </div>
              <ReferenceLinks data={data} ids={concept.references} />
            </>
          ) : (
            <Empty title="Choose a concept">
              Inspect its lesson, prerequisite path, and your private notes.
            </Empty>
          )}
        </aside>
      </div>
      <section className="panel learning-path">
        <div className="section-heading">
          <div>
            <h2>Your smallest useful foundation path</h2>
            <p>
              Proficient foundations are omitted. Skip guidance without marking
              knowledge mastered.
            </p>
          </div>
          <Badge>{data.path.length} recommended steps</Badge>
        </div>
        <ol>
          {data.path.map((step) => (
            <li
              key={step.concept.id}
              className={skips.includes(step.concept.id) ? "skipped" : ""}
            >
              <div>
                <button
                  className="text-link"
                  onClick={() => setSelected(step.concept.id)}
                >
                  {step.concept.name}
                </button>
                <p>{step.reason}</p>
              </div>
              <Badge tone="muted">
                {step.performance?.status ?? "Not studied"}
              </Badge>
              <Button
                variant="ghost"
                onClick={() =>
                  setSkips((ids) =>
                    ids.includes(step.concept.id)
                      ? ids.filter((i) => i !== step.concept.id)
                      : [...ids, step.concept.id],
                  )
                }
              >
                {skips.includes(step.concept.id)
                  ? "Include again"
                  : "Skip recommendation"}
              </Button>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel">
        <h2>Notes connected to this foundation</h2>
        {notes.length ? (
          notes.map((n) => (
            <button
              className="saved-row"
              key={n.id}
              onClick={() => actions.go("notebook", "&entry=" + n.id)}
            >
              <BookOpen size={16} />
              <span>
                <strong>{n.title}</strong>
                <small>{new Date(n.updated_at).toLocaleString()}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))
        ) : (
          <p>
            No private notes are linked to this concept or its recommended
            prerequisites yet.
          </p>
        )}
      </section>
    </>
  );
}
