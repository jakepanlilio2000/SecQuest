"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Download,
  FolderPlus,
  Plus,
  Search,
  Star,
  Trash2,
  RotateCcw,
  Save,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import {
  api,
  Button,
  Badge,
  Empty,
  PageTitle,
  download,
  type Profile,
} from "./shared";
import { SafeMarkdown } from "./safe-markdown";
import { ReferenceLinks } from "./intelligence-shared";
import { NotebookRevisionTools } from "./completion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import type { NotebookEntry } from "@/lib/intelligence-types";
interface NotebookList {
  entries: NotebookEntry[];
  total: number;
  page: number;
  folders: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  sources: { id: string; name: string; url: string }[];
}
interface Draft {
  title: string;
  body: string;
  notebookId: string | null;
  category: string;
  objective: string | null;
  conceptId: string | null;
  questionId: string | null;
  questionRevision: number | null;
  sourceRefs: string[];
  tags: string[];
  pinned: boolean;
}
const toDraft = (e: NotebookEntry): Draft => ({
  title: e.title,
  body: e.body,
  notebookId: e.notebook_id,
  category: e.category,
  objective: e.objective,
  conceptId: e.concept_id,
  questionId: e.question_id,
  questionRevision: e.question_revision,
  sourceRefs: JSON.parse(e.source_refs),
  tags: e.tags,
  pinned: !!e.pinned,
});
export function Notebook({
  user,
  entryId,
  conceptId,
}: {
  user: Profile;
  entryId: string | null;
  conceptId: string | null;
}) {
  const [list, setList] = useState<NotebookList | null>(null),
    [active, setActive] = useState<NotebookEntry | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [tagsText, setTagsText] = useState(""),
    [retryDelay, setRetryDelay] = useState(1100),
    [search, setSearch] = useState(""),
    [folder, setFolder] = useState(""),
    [tag, setTag] = useState(""),
    [focus, setFocus] = useState(""),
    [trash, setTrash] = useState(false),
    [pinned, setPinned] = useState(false),
    [page, setPage] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Choose a note or create one."),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [conflict, setConflict] = useState(false),
    [view, setView] = useState<"edit" | "preview" | "split">("edit"),
    [folderName, setFolderName] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null),
    draftBaseRevision = useRef<number | null>(null),
    currentDraft = useRef(draft),
    currentActive = useRef(active),
    savePacket = useRef<{
      snapshot: string;
      mutationId: string;
      expectedRevision: number;
    } | null>(null);
  currentDraft.current = draft;
  currentActive.current = active;
  const key = (id: string) => `secquest:notebook:${user.id}:${id}`;
  const loadList = useCallback(async () => {
    setList(
      await api<NotebookList>(
        `notebook?${new URLSearchParams({ search, folder, tag, focus, trash: String(trash), pinned: String(pinned), page: String(page), ...(conceptId ? { concept: conceptId } : {}) })}`,
      ),
    );
  }, [search, folder, tag, focus, trash, pinned, page, conceptId]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(
      () =>
        loadList().catch((e) => {
          if (alive) setError(e.message);
        }),
      180,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [loadList]);
  const open = useCallback(
    async (id: string) => {
      setError("");
      const { entry } = await api<{ entry: NotebookEntry }>(
        `notebook/entries/${id}`,
      );
      let next = toDraft(entry);
      let recovered = false;
      let changedElsewhere = false;
      let baseRevision = entry.revision;
      try {
        const raw = sessionStorage.getItem(
          `secquest:notebook:${user.id}:${id}`,
        );
        if (raw) {
          const local = JSON.parse(raw);
          if (
            local.draft &&
            JSON.stringify(local.draft) !== JSON.stringify(next)
          ) {
            next = local.draft;
            recovered = true;
            baseRevision = local.revision;
            changedElsewhere = local.revision !== entry.revision;
          }
        }
      } catch {
        setError(
          "A local recovery draft could not be read. The server copy is still available.",
        );
      }
      setActive(entry);
      draftBaseRevision.current = baseRevision;
      setDraft(next);
      setTagsText(next.tags.join(", "));
      setDirty(recovered);
      setConflict(changedElsewhere);
      savePacket.current = null;
      setStatus(
        changedElsewhere
          ? "Local draft recovered; compare with the newer server revision before saving."
          : recovered
            ? "Recovered a local draft; autosave will resume."
            : `Saved · ${new Date(entry.updated_at).toLocaleString()}`,
      );
    },
    [user.id],
  );
  useEffect(() => {
    if (entryId) open(entryId).catch((e) => setError(e.message));
  }, [entryId, open]);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("secquest:notebook-dirty", { detail: dirty || busy }),
    );
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.dispatchEvent(
        new CustomEvent("secquest:notebook-dirty", { detail: false }),
      );
    };
  }, [dirty, busy]);
  useEffect(() => {
    if (active && draft && dirty)
      try {
        sessionStorage.setItem(
          key(active.id),
          JSON.stringify({
            revision: draftBaseRevision.current ?? active.revision,
            draft,
          }),
        );
      } catch {
        setError(
          "Local recovery storage is unavailable. Keep this page open until the server confirms the save.",
        );
      }
  }, [active, draft, dirty]);
  async function save() {
    if (!active || !draft || busy || conflict || active.deleted_at) return;
    setBusy(true);
    setError("");
    setStatus("Saving…");
    const snapshot = JSON.stringify(draft);
    const packet =
      savePacket.current?.snapshot === snapshot &&
      savePacket.current.expectedRevision === active.revision
        ? savePacket.current
        : {
            snapshot,
            mutationId: crypto.randomUUID(),
            expectedRevision: active.revision,
          };
    savePacket.current = packet;
    try {
      const { entry } = await api<{ entry: NotebookEntry }>(
        "notebook/entries",
        "POST",
        {
          id: active.id,
          ...draft,
          mutationId: packet.mutationId,
          expectedRevision: packet.expectedRevision,
        },
      );
      setActive(entry);
      draftBaseRevision.current = entry.revision;
      if (JSON.stringify(currentDraft.current) === snapshot) {
        setDraft(toDraft(entry));
        setDirty(false);
        sessionStorage.removeItem(key(entry.id));
      }
      savePacket.current = null;
      setStatus(`Saved · ${new Date(entry.updated_at).toLocaleTimeString()}`);
      setRetryDelay(1100);
      await loadList();
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setStatus("Not saved — your recovery draft is retained.");
      setRetryDelay((delay) => Math.min(30000, delay * 2));
      if (message.includes("changed elsewhere")) {
        setConflict(true);
        try {
          const latest = await api<{ entry: NotebookEntry }>(
            `notebook/entries/${active.id}`,
          );
          setActive(latest.entry);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !dirty ||
      busy ||
      conflict ||
      !draft?.title.trim() ||
      active?.deleted_at
    )
      return;
    const timer = setTimeout(() => {
      void save();
    }, retryDelay);
    return () => clearTimeout(timer);
  }, [draft, active?.revision, dirty, busy, conflict, retryDelay]);
  function update(values: Partial<Draft>) {
    setDraft((old) => (old ? { ...old, ...values } : old));
    setDirty(true);
    setStatus("Unsaved changes");
  }
  async function choose(id: string) {
    if (busy) return;
    if (
      dirty &&
      !window.confirm(
        "A local recovery draft is saved. Open another note before these changes reach the server?",
      )
    )
      return;
    await open(id);
  }
  async function create() {
    if (
      dirty &&
      !window.confirm(
        "Keep the current local recovery draft and create a new note?",
      )
    )
      return;
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const { entry } = await api<{ entry: NotebookEntry }>(
        "notebook/entries",
        "POST",
        {
          id,
          mutationId: crypto.randomUUID(),
          expectedRevision: 0,
          title: "Untitled note",
          body: "",
          notebookId: folder || null,
          conceptId: conceptId ?? null,
        },
      );
      setActive(entry);
      draftBaseRevision.current = entry.revision;
      setDraft(toDraft(entry));
      setDirty(false);
      setConflict(false);
      setStatus("New note saved.");
      setTagsText("");
      setTrash(false);
      await loadList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function insert(before: string, after = "") {
    const control = textarea.current;
    if (!control || !draft) return;
    const start = control.selectionStart,
      end = control.selectionEnd;
    update({
      body:
        draft.body.slice(0, start) +
        before +
        draft.body.slice(start, end) +
        after +
        draft.body.slice(end),
    });
    requestAnimationFrame(() => {
      control.focus();
      control.setSelectionRange(start + before.length, end + before.length);
    });
  }
  async function remove(restore = false) {
    if (!active) return;
    if (
      dirty &&
      !window.confirm(
        "Keep a local recovery draft and move the saved server note to Trash?",
      )
    )
      return;
    setBusy(true);
    try {
      const { entry } = await api<{ entry: NotebookEntry }>(
        `notebook/entries/${active.id}${restore ? "/restore" : ""}`,
        restore ? "POST" : "DELETE",
        {},
      );
      setActive(entry);
      draftBaseRevision.current = entry.revision;
      setDraft(toDraft(entry));
      setDirty(false);
      setStatus(
        restore
          ? "Note restored."
          : "Note moved to Trash; it can be recovered.",
      );
      await loadList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="PERSONAL LEARNING"
        title="My Cybersecurity Notebook"
        description="Make the concepts your own. Private notes, linked evidence, and recoverable drafts."
        action={
          <Button onClick={create} disabled={busy}>
            <Plus size={16} />
            New note
          </Button>
        }
      />
      {error && (
        <div className="alert error" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}
      <div className="notebook-tools">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search private notes"
            placeholder="Search title, writing, objective, category, or tag…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              const result = await api<{ data: unknown; markdown: string }>(
                "notebook/export",
              );
              download(
                "secquest-notebook.json",
                JSON.stringify(result.data, null, 2),
                "application/json",
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Download size={15} />
          JSON
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              const result = await api<{ markdown: string }>("notebook/export");
              download(
                "secquest-notebook.md",
                result.markdown,
                "text/markdown",
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Download size={15} />
          Markdown
        </Button>
      </div>
      <div className="notebook-layout">
        <aside className="panel notebook-list">
          <div className="notebook-filter-row">
            <button
              className={!trash ? "active" : ""}
              onClick={() => {
                setTrash(false);
                setPage(0);
              }}
            >
              Notes
            </button>
            <button
              className={trash ? "active" : ""}
              onClick={() => {
                setTrash(true);
                setPage(0);
              }}
            >
              <Trash2 size={13} />
              Trash
            </button>
            <button aria-pressed={pinned} onClick={() => setPinned(!pinned)}>
              <Star size={13} />
              {pinned ? "Pinned only" : "All notes"}
            </button>
          </div>
          <label>
            Learning links
            <select
              aria-label="Notebook learning filter"
              value={focus}
              onChange={(e) => {
                setFocus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All linked notes</option>
              <option value="gaps">Knowledge gaps</option>
              <option value="due">Due reviews</option>
            </select>
          </label>
          <label>
            Folder
            <select
              aria-label="Notebook folder filter"
              value={folder}
              onChange={(e) => {
                setFolder(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All folders</option>
              {list?.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select
              aria-label="Notebook tag filter"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All tags</option>
              {list?.tags.map((t) => (
                <option key={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <form
            className="folder-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("notebook/folders", "POST", { name: folderName });
                setFolderName("");
                await loadList();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <input
              aria-label="New notebook folder"
              placeholder="Custom folder…"
              maxLength={80}
              required
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <Button
              type="submit"
              variant="ghost"
              aria-label="Create notebook folder"
            >
              <FolderPlus size={16} />
            </Button>
          </form>
          <p className="fine-print">
            {list?.total ?? 0} matching private notes
            {conceptId ? " · filtered to this concept" : ""}
          </p>
          <div className="note-results">
            {list?.entries.map((e) => (
              <button
                className={active?.id === e.id ? "active" : ""}
                key={e.id}
                disabled={busy}
                onClick={() => choose(e.id)}
              >
                <strong>
                  {e.pinned ? <Star size={12} /> : <BookOpen size={12} />}{" "}
                  {e.title}
                </strong>
                <small>
                  {e.objective ? `Objective ${e.objective} · ` : ""}
                  {e.tags.slice(0, 2).join(", ")}
                </small>
                <small>{new Date(e.updated_at).toLocaleString()}</small>
              </button>
            ))}
          </div>
          {list && !list.entries.length && (
            <Empty title={trash ? "Trash is empty" : "No notes match yet"}>
              Save a learning explanation or create a personal note.
            </Empty>
          )}
          <div className="note-pagination">
            <Button
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span>{page + 1}</span>
            <Button
              variant="ghost"
              disabled={!list || (page + 1) * 20 >= list.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </aside>
        <section className="panel notebook-editor">
          {active && draft ? (
            <>
              <div className="editor-heading">
                <div className="save-status" role="status">
                  <Clock3 size={14} />
                  {status}
                </div>
                <div className="button-row">
                  {!active.deleted_at && (
                    <>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => update({ pinned: !draft.pinned })}
                      >
                        <Star size={14} />
                        {draft.pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button
                        disabled={busy || !dirty || conflict}
                        onClick={save}
                      >
                        <Save size={14} />
                        Save now
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove(!!active.deleted_at)}
                  >
                    {active.deleted_at ? (
                      <RotateCcw size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}{" "}
                    {active.deleted_at ? "Restore" : "Move to Trash"}
                  </Button>
                </div>
              </div>
              {active.deleted_at && (
                <div className="alert">
                  This saved note is in Trash. Restore it to continue editing.
                </div>
              )}
              {conflict && (
                <div className="conflict-panel">
                  <h3>A newer server revision exists</h3>
                  <p>
                    Your writing is still in the local editor. Compare it with
                    the current server copy before applying a merge.
                  </p>
                  <details>
                    <summary>Show the server copy</summary>
                    <h4>{active.title}</h4>
                    <p>
                      {active.category} · Tags:{" "}
                      {active.tags.join(", ") || "None"}
                    </p>
                    <SafeMarkdown>{active.body}</SafeMarkdown>
                  </details>
                  <div className="button-row">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        download(
                          "secquest-recovery-draft.md",
                          `# ${draft.title}\n\n${draft.body}\n\nCategory: ${draft.category}\nTags: ${draft.tags.join(", ")}\nObjective: ${draft.objective ?? "None"}\nConcept: ${draft.conceptId ?? "None"}\nQuestion: ${draft.questionId ?? "None"} revision ${draft.questionRevision ?? "None"}\nSource references: ${draft.sourceRefs.join(", ")}\n`,
                          "text/markdown",
                        );
                      }}
                    >
                      Download local draft
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setConflict(false);
                        draftBaseRevision.current = active.revision;
                        setDirty(true);
                        savePacket.current = null;
                        setStatus(
                          "Merge your writing in the editor; save when ready.",
                        );
                      }}
                    >
                      Use this editor as a reviewed merge
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Replace the local editor with the saved server copy?",
                          )
                        ) {
                          sessionStorage.removeItem(key(active.id));
                          setDraft(toDraft(active));
                          draftBaseRevision.current = active.revision;
                          setTagsText(active.tags.join(", "));
                          setDirty(false);
                          setConflict(false);
                        }
                      }}
                    >
                      Reload server copy
                    </Button>
                  </div>
                </div>
              )}
              <label>
                Title
                <input
                  aria-label="Note title"
                  required
                  maxLength={180}
                  disabled={!!active.deleted_at}
                  value={draft.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </label>
              <div className="note-metadata">
                <label>
                  Folder
                  <select
                    disabled={!!active.deleted_at}
                    value={draft.notebookId ?? ""}
                    onChange={(e) =>
                      update({ notebookId: e.target.value || null })
                    }
                  >
                    <option value="">Personal collection</option>
                    {list?.folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <input
                    maxLength={80}
                    disabled={!!active.deleted_at}
                    value={draft.category}
                    onChange={(e) => update({ category: e.target.value })}
                  />
                </label>
                <label>
                  Tags · comma separated
                  <input
                    aria-label="Note tags"
                    disabled={!!active.deleted_at}
                    value={tagsText}
                    onChange={(e) => {
                      setTagsText(e.target.value);
                      update({
                        tags: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .slice(0, 15),
                      });
                    }}
                  />
                </label>
              </div>
              <NotebookRevisionTools
                entry={active}
                dirty={dirty || busy || conflict}
                selectedText={() => {
                  const control = textarea.current;
                  return control &&
                    control.selectionEnd > control.selectionStart
                    ? control.value.slice(
                        control.selectionStart,
                        control.selectionEnd,
                      )
                    : draft.body;
                }}
                onMessage={setStatus}
                onRestore={(entry) => {
                  setActive(entry);
                  setDraft(toDraft(entry));
                  setTagsText(entry.tags.join(", "));
                  draftBaseRevision.current = entry.revision;
                  setDirty(false);
                  setConflict(false);
                  sessionStorage.removeItem(key(entry.id));
                  setStatus(`Restored as revision ${entry.revision}.`);
                  void loadList().catch((e) => setError(e.message));
                }}
              />
              <Tabs
                value={view}
                onValueChange={(v) => setView(v as typeof view)}
              >
                <div className="editor-tabs">
                  <TabsList>
                    {(["edit", "preview", "split"] as const).map((mode) => (
                      <TabsTrigger value={mode} key={mode}>
                        {mode}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <span>Safe Markdown · HTML and remote images disabled</span>
                </div>
                <TabsContent value={view}>
                  {view !== "preview" && !active.deleted_at && (
                    <div className="markdown-toolbar">
                      {[
                        ["H2", "## ", ""],
                        ["Bold", "**", "**"],
                        ["Italic", "*", "*"],
                        ["Bullets", "\n- ", ""],
                        ["Numbered", "\n1. ", ""],
                        ["Checklist", "\n- [ ] ", ""],
                        ["Code", "\n```\n", "\n```\n"],
                        [
                          "Table",
                          "\n| Concept | Meaning |\n| --- | --- |\n| ",
                          " | |\n",
                        ],
                        ["Quote", "\n> ", ""],
                        ["Link", "[", "](https://example.com)"],
                      ].map(([label, before, after]) => (
                        <button
                          key={label}
                          onClick={() => insert(before, after)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={`note-writing ${view}`}>
                    {view !== "preview" && (
                      <textarea
                        ref={textarea}
                        aria-label="Note Markdown content"
                        spellCheck
                        disabled={!!active.deleted_at}
                        value={draft.body}
                        onChange={(e) => update({ body: e.target.value })}
                      />
                    )}{" "}
                    {view !== "edit" && (
                      <div className="note-preview">
                        <SafeMarkdown>
                          {draft.body ||
                            "*Your preview appears here as you write.*"}
                        </SafeMarkdown>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <div className="note-links">
                {!!draft.sourceRefs.length && (
                  <ReferenceLinks
                    ids={draft.sourceRefs}
                    data={{ sources: list?.sources ?? [] }}
                  />
                )}
                <Badge tone="blue">
                  {draft.objective
                    ? `Objective ${draft.objective}`
                    : "Personal note"}
                </Badge>
                {draft.questionId && (
                  <Badge>
                    Question {draft.questionId} · r{draft.questionRevision}
                  </Badge>
                )}
                {draft.conceptId && (
                  <a
                    href={`/?view=knowledge-map&concept=${encodeURIComponent(draft.conceptId)}`}
                  >
                    Open linked concept <ArrowRight size={13} />
                  </a>
                )}
                <small>
                  Revision {active.revision} · Reading or editing notes does not
                  award mastery or XP.
                </small>
              </div>
            </>
          ) : (
            <Empty icon={BookOpen} title="A place to work things out">
              Create a note, open a saved explanation, or select an entry from
              your collection.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
