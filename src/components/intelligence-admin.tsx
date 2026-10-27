"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, Check, Trash2, Network } from "lucide-react";
import { api, Button, Badge, download, type Profile } from "./shared";
import type { loadGraph, loadDefinitions } from "@/lib/intelligence-store";
import type {
  MisconceptionMapping,
  IntelligencePolicy,
} from "@/lib/intelligence-types";
interface AdminIntelligence extends Awaited<ReturnType<typeof loadGraph>> {
  misconceptions: Awaited<ReturnType<typeof loadDefinitions>>;
  distractorMappings: MisconceptionMapping[];
  policy: IntelligencePolicy;
  orphans: string[];
  coverage: { conceptId: string; questions: number }[];
  copyPermissions: {
    question_id: string;
    revision: number;
    copy_allowed: number;
  }[];
}
export function IntelligenceAdmin({ user }: { user: Profile }) {
  const [data, setData] = useState<AdminIntelligence | null>(null),
    [editor, setEditor] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const canEdit = ["content_admin", "system_admin"].includes(user.role);
  const load = useCallback(
    async () => setData(await api<AdminIntelligence>("admin/intelligence")),
    [],
  );
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  return (
    <section className="panel intelligence-admin">
      <div className="section-heading">
        <div>
          <h2>
            <Network size={19} /> Concept intelligence management
          </h2>
          <p>
            Global concepts, cycle-checked learning relationships, and
            revision-specific distractor mappings.
          </p>
        </div>
        <Badge tone="blue">ADDITIVE CONTENT</Badge>
      </div>
      {error && <div className="alert error">{error}</div>}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      {data && (
        <>
          <div className="intelligence-admin-counts">
            <Badge>{data.nodes.length} concepts</Badge>
            <Badge>{data.edges.length} relationships</Badge>
            <Badge>{data.distractorMappings.length} distractor mappings</Badge>
            <Badge>
              {data.misconceptions.length} misconception definitions
            </Badge>
          </div>
          <p className="fine-print">
            Orphaned concepts:{" "}
            {data.orphans.length
              ? data.orphans
                  .map((id) => data.nodes.find((n) => n.id === id)?.name ?? id)
                  .join(", ")
              : "None"}
            . Orphaned lessons remain available; no prerequisite is invented to
            connect them.
          </p>
          <div className="button-row">
            <Button
              variant="ghost"
              onClick={() =>
                download(
                  "secquest-intelligence.json",
                  JSON.stringify(
                    {
                      concepts: data.nodes,
                      relationships: data.edges,
                      misconceptions: data.misconceptions,
                      distractorMappings: data.distractorMappings,
                      questionConcepts: data.mappings.map((m) => ({
                        questionId: m.question_id,
                        revision: m.revision,
                        conceptId: m.concept_id,
                      })),
                      copyPermissions: data.copyPermissions.map((p) => ({
                        questionId: p.question_id,
                        revision: p.revision,
                        allowed: !!p.copy_allowed,
                      })),
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              <Download size={14} />
              Export content mappings
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setEditor(
                  JSON.stringify({ concepts: [data.nodes[0]] }, null, 2),
                )
              }
            >
              Edit a concept template
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setEditor(
                  JSON.stringify({ relationships: [data.edges[0]] }, null, 2),
                )
              }
            >
              Edit relationship template
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setEditor(
                  JSON.stringify(
                    {
                      misconceptions: [data.misconceptions[0]],
                      distractorMappings: data.distractorMappings.filter(
                        (m) => m.misconceptionId === data.misconceptions[0].id,
                      ),
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Edit misconception template
            </Button>
            {user.role === "system_admin" && (
              <Button
                variant="ghost"
                onClick={() =>
                  setEditor(
                    JSON.stringify(
                      {
                        policy: {
                          ...data.policy,
                          version: data.policy.version + "-reviewed-2",
                        },
                      },
                      null,
                      2,
                    ),
                  )
                }
              >
                Version detection / forecast parameters
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={!canEdit}
              onClick={() =>
                setEditor(
                  JSON.stringify(
                    {
                      copyPermissions: data.copyPermissions.map((p) => ({
                        questionId: p.question_id,
                        revision: p.revision,
                        allowed: !!p.copy_allowed,
                      })),
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Edit notebook copy permissions
            </Button>
          </div>
          <label>
            Transactional content import
            <input
              type="file"
              accept=".json"
              disabled={!canEdit || busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1_000_000) {
                  setError("Import exceeds 1 MB.");
                  return;
                }
                setEditor(await file.text());
                e.target.value = "";
              }}
            />
          </label>
          <label>
            Intelligence content JSON
            <textarea
              className="code-editor"
              aria-label="Intelligence content JSON"
              disabled={!canEdit || busy}
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
              placeholder='{"concepts": [], "relationships": [], "misconceptions": [], "distractorMappings": [], "questionConcepts": []}'
            />
          </label>
          <Button
            disabled={!canEdit || busy || !editor.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("admin/intelligence", "POST", JSON.parse(editor));
                await load();
                setMessage(
                  "Validated content saved. Existing attempts, XP and review schedules were preserved.",
                );
                setEditor("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Check size={15} />
            Validate graph & save transaction
          </Button>
          <p className="fine-print">
            Prerequisite/builds-upon arrows point from the foundation to the
            dependent concept. Related/confused/next links do not become
            prerequisites. New policy versions are immutable; copy permission
            must be explicitly granted only for content with appropriate rights.
          </p>
          <details>
            <summary>Concept practice coverage</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Concept</th>
                    <th>Mapped revisions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage.map((c) => (
                    <tr key={c.conceptId}>
                      <td>
                        {data.nodes.find((n) => n.id === c.conceptId)?.name}
                      </td>
                      <td>{c.questions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>Manage relationships</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Foundation / source</th>
                    <th>Relationship</th>
                    <th>Dependent / target</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.edges.map((edge) => (
                    <tr key={edge.id}>
                      <td>
                        {data.nodes.find((n) => n.id === edge.sourceId)?.name}
                      </td>
                      <td>{edge.kind}</td>
                      <td>
                        {data.nodes.find((n) => n.id === edge.targetId)?.name}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          disabled={!canEdit || busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await api(
                                "admin/intelligence/relationship",
                                "DELETE",
                                { id: edge.id },
                              );
                              await load();
                              setMessage(
                                "Relationship removed; learner history retained. The audit log retains its prior definition.",
                              );
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <Trash2 size={12} />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
