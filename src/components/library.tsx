"use client";
import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock3,
  GraduationCap,
  Layers3,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import type { Mode, PublicQuestion } from "@/lib/types";
import {
  Term,
  Source,
  Card,
  api,
  Button,
  Badge,
  Empty,
  PageTitle,
  fuzzyMatch,
} from "./shared";
import { Metric } from "./dashboard";
export function QuestionBank({
  onStart,
}: {
  onStart: (q: PublicQuestion) => void;
}) {
  const [list, setList] = useState<PublicQuestion[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0),
    [query, setQuery] = useState(""),
    [domain, setDomain] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api<{ questions: PublicQuestion[]; total: number }>(
          `catalog?${new URLSearchParams({ search: query, domain, difficulty, page: String(page) })}`,
        )
          .then((r) => {
            if (active) {
              setList(r.questions);
              setTotal(r.total);
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, domain, difficulty, page]);
  return (
    <>
      <PageTitle
        eyebrow="THE PRACTICE LIBRARY"
        title="Find your next challenge."
        description="Original questions mapped to the official V8 objectives. Explore prompts without revealing answers."
        action={<Badge tone="blue">{total} matching questions</Badge>}
      />
      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search questions"
            placeholder="Search questions, concepts, or objectives…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="Filter domain"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All domains</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option value={n} key={n}>
              Domain {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter difficulty"
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All difficulties</option>
          {["easy", "medium", "hard", "expert"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="question-bank-grid">
        {list.map((q) => (
          <article className="panel bank-card" key={q.id}>
            <div>
              <Badge tone="blue">{q.objective}</Badge>
              <Badge tone="muted">{q.difficulty}</Badge>
              <small>{q.type}</small>
            </div>
            <h3>{q.prompt}</h3>
            <p>{q.concept}</p>
            <button className="text-link" onClick={() => onStart(q)}>
              Practice this objective <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty title="No matching questions">
          Broaden your filters to explore the available starter content.
        </Empty>
      )}
      <div className="pagination">
        <Button
          variant="ghost"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={15} />
          Previous
        </Button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(total / 12))}
        </span>
        <Button
          variant="ghost"
          disabled={(page + 1) * 12 >= total}
          onClick={() => setPage(page + 1)}
        >
          Next
          <ArrowRight size={15} />
        </Button>
      </div>
    </>
  );
}

export function Knowledge({
  search,
  setSearch,
  start,
}: {
  search: string;
  setSearch: (s: string) => void;
  start: (m: Mode, o?: Record<string, unknown>) => Promise<void>;
}) {
  const [terms, setTerms] = useState<Term[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [active, setActive] = useState<Term | null>(null),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<{
      message: string;
      concepts: {
        term: string;
        definition: string;
        examples: string[];
        objective: string;
        sources: string[];
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<{ terms: Term[]; sources: Source[] }>("knowledge")
      .then((r) => {
        setTerms(r.terms);
        setSources(r.sources);
      })
      .catch((e) => setError(e.message));
  }, []);
  const filtered = terms.filter(
    (t) => !search || fuzzyMatch(search, `${t.term} ${t.definition}`),
  );
  return (
    <>
      <PageTitle
        eyebrow="THE KNOWLEDGE BASE"
        title="Understand the moving parts."
        description="Clear definitions, grounded explanations, and practical connections."
      />
      <div className="knowledge-layout">
        <section>
          <label className="search-field">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TLS, identity, Zero Trust…"
              aria-label="Search knowledge base"
            />
          </label>
          <div className="term-list">
            {filtered.map((t) => (
              <button
                key={t.term}
                className={`term-row ${active?.term === t.term ? "selected" : ""}`}
                onClick={() => setActive(t)}
              >
                <span>
                  <strong>{t.term}</strong>
                  <small>Objective {t.objective}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {!filtered.length && (
            <Empty title="No close matches">
              Try an acronym or a shorter term.
            </Empty>
          )}
        </section>
        <section className="panel term-detail">
          {active ? (
            <>
              <Badge tone="blue">OBJECTIVE {active.objective}</Badge>
              <h2>{active.term}</h2>
              <p className="lead">{active.definition}</p>
              <h3>How it applies</h3>
              <p>{active.explanation}</p>
              {active.examples.map((e, i) => (
                <div className="concept-definition" key={e}>
                  <small>EXAMPLE {i + 1}</small>
                  <p>{e}</p>
                </div>
              ))}
              <h3>A common misconception</h3>
              <p>{active.misconception}</p>
              <h3>References</h3>
              <ul className="source-links">
                {active.sources.map((s) => {
                  const source = sources.find((x) => x.id === s);
                  return source ? (
                    <li key={s}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.name} ↗
                      </a>
                      <small>
                        {source.publisher} · verified {source.verifiedAt}
                      </small>
                    </li>
                  ) : null;
                })}
              </ul>
              <Button
                onClick={() =>
                  start("practice", { objective: active.objective, count: 5 })
                }
              >
                Put it into practice <ArrowRight size={16} />
              </Button>
            </>
          ) : (
            <Empty icon={GraduationCap} title="Make the concepts connect">
              Choose a term to see its definition, examples, and practice links.
            </Empty>
          )}
        </section>
      </div>
      <section className="panel tutor-panel">
        <div className="section-heading">
          <div>
            <h2>
              <Sparkles size={20} /> Your concept companion
            </h2>
            <p>
              Search the stored educational library. This installation uses
              deterministic retrieval, without an AI provider.
            </p>
          </div>
          <Badge tone="muted">WORKS WITHOUT AI</Badge>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setResults(await api("tutor", "POST", { query }));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            minLength={2}
            maxLength={500}
            placeholder="I don’t understand the difference between IDS and IPS…"
            aria-label="Concept question"
          />
          <Button type="submit">
            Find explanations <Search size={16} />
          </Button>
        </form>
        {error && <p className="alert error">{error}</p>}
        {results && (
          <div className="tutor-results">
            <p>{results.message}</p>
            {results.concepts.map((c) => (
              <article key={c.term}>
                <h3>{c.term}</h3>
                <p>{c.definition}</p>
                <small>{c.examples[0]}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function Flashcards({ notify }: { notify: (m: string) => void }) {
  const [cards, setCards] = useState<Card[]>([]),
    [flipped, setFlipped] = useState(false),
    [index, setIndex] = useState(0),
    [error, setError] = useState(""),
    [create, setCreate] = useState(false),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api<{ cards: Card[] }>("flashcards");
    setCards(r.cards);
    setIndex(0);
    setFlipped(false);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const due = cards.filter((c) => c.due_at <= new Date().toISOString()),
    card = due[index];
  return (
    <>
      <PageTitle
        eyebrow="ACTIVE RECALL"
        title="Don’t just recognize it. Recall it."
        description="Save concepts from explanations or make a personal card. Flashcard reviews remain separate from exam attempts."
        action={
          <Button onClick={() => setCreate(!create)}>
            <Plus size={16} />
            Create a card
          </Button>
        }
      />
      {error && <div className="alert error">{error}</div>}
      <div className="stats-grid compact">
        <Metric
          label="YOUR LIBRARY"
          value={String(cards.length)}
          icon={BookOpen}
          detail="Personal learning cards"
          tone="blue"
        />
        <Metric
          label="DUE NOW"
          value={String(due.length)}
          icon={Clock3}
          detail="Ready for active recall"
          tone="green"
        />
      </div>
      {create && (
        <form
          className="panel form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api("flashcards", "POST", {
                front: f.get("front"),
                back: f.get("back"),
                objective: f.get("objective"),
              });
              await load();
              setCreate(false);
              notify("Flashcard created.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Front
            <input name="front" required minLength={2} maxLength={500} />
          </label>
          <label>
            Objective <small>Optional</small>
            <input name="objective" placeholder="1.3" maxLength={20} />
          </label>
          <label className="full-width">
            Back
            <textarea name="back" required minLength={2} maxLength={3000} />
          </label>
          <Button type="submit" disabled={busy}>
            Save card
          </Button>
        </form>
      )}
      {card ? (
        <div className="flashcard-area">
          <div
            className="flashcard"
            tabIndex={0}
            role="button"
            aria-label="Flip flashcard"
            onClick={() => setFlipped(!flipped)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped(!flipped);
              }
            }}
          >
            <Badge tone="blue">
              {card.objective ? "OBJECTIVE " + card.objective : "PERSONAL CARD"}
            </Badge>
            <small>{flipped ? "YOUR ANSWER" : "CAN YOU EXPLAIN THIS?"}</small>
            <h2>{flipped ? card.back : card.front}</h2>
            <span>
              <Layers3 size={16} />
              Click or press Enter to flip
            </span>
          </div>
          {flipped && (
            <div className="recall-ratings">
              {["Again", "Hard", "Good", "Easy"].map((label, rating) => (
                <Button
                  variant="ghost"
                  key={rating}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`flashcards/${card.id}`, "POST", { rating });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          <p>
            {due.length} cards due · future reviews are scheduled from your
            recall rating
          </p>
        </div>
      ) : (
        <section className="panel">
          <Empty
            icon={BookOpen}
            title={
              cards.length
                ? "You’re caught up."
                : "Start a collection of useful concepts."
            }
          >
            {cards.length
              ? "Your next cards will appear when their review is due."
              : "Create a card above or save a concept from a question explanation."}
          </Empty>
        </section>
      )}
      <section className="panel">
        <h2>Your card library</h2>
        {cards.map((c) => (
          <div className="library-card-row" key={c.id}>
            <span>
              <strong>{c.front}</strong>
              <small>
                {c.objective ? `Objective ${c.objective} · ` : ""}
                {c.repetitions} reviews
              </small>
            </span>
            <Badge
              tone={c.due_at <= new Date().toISOString() ? "green" : "muted"}
            >
              {c.due_at <= new Date().toISOString()
                ? "Due now"
                : `Due ${new Date(c.due_at).toLocaleDateString()}`}
            </Badge>
          </div>
        ))}
      </section>
    </>
  );
}
