"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Note,
  emptyNote,
  formatDate,
  loadNotes,
  saveNotes,
  snippet,
  wordCount,
} from "@/lib/notes";

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "page">("list"); // mobile only
  const [ready, setReady] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  // load once on mount
  useEffect(() => {
    const loaded = loadNotes();
    setNotes(loaded);
    setActiveId(loaded[0]?.id ?? null);
    setReady(true);
  }, []);

  // persist whenever notes change (after initial load)
  useEffect(() => {
    if (ready) saveNotes(notes);
  }, [notes, ready]);

  const active = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [notes, query]);

  function createNote() {
    const n = emptyNote();
    setNotes((prev) => [n, ...prev]);
    setActiveId(n.id);
    setView("page");
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function updateActive(patch: Partial<Note>) {
    if (!active) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n
      )
    );
  }

  function deleteActive() {
    if (!active) return;
    const remaining = notes.filter((n) => n.id !== active.id);
    setNotes(remaining);
    setActiveId(remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null);
    setView("list");
  }

  function openNote(id: string) {
    setActiveId(id);
    setView("page");
  }

  return (
    <div className="app" data-view={view}>
      {/* ---------- the marbled cover ---------- */}
      <aside className="cover">
        <div className="cover__head">
          <div className="label">Notebook № 1</div>
          <h1 className="wordmark">
            Composition<em>.</em>
          </h1>
        </div>

        <div className="search">
          <Search />
          <input
            type="search"
            placeholder="Search the notebook"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search notes"
          />
        </div>

        <button className="new-btn" onClick={createNote}>
          <span>+</span> New note
        </button>

        <nav className="list" aria-label="Notes">
          <div className="list__heading">
            {query ? `${filtered.length} found` : `${notes.length} pages`}
          </div>

          {filtered.length === 0 ? (
            <p className="list__empty">
              {query
                ? "Nothing matches that yet. Try fewer words."
                : "The notebook is empty. Start the first page."}
            </p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                className={`entry${n.id === activeId ? " entry--active" : ""}`}
                onClick={() => openNote(n.id)}
              >
                <p
                  className={`entry__title${
                    n.title.trim() ? "" : " entry__title--empty"
                  }`}
                >
                  {n.title.trim() || "Untitled"}
                </p>
                {snippet(n.body) && (
                  <p className="entry__snippet">{snippet(n.body)}</p>
                )}
                <div className="entry__meta">{formatDate(n.updatedAt)}</div>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* ---------- the ruled page ---------- */}
      <section className="page">
        {active ? (
          <>
            <div className="page__bar">
              <button
                className="back-btn"
                onClick={() => setView("list")}
                aria-label="Back to notes"
              >
                ‹ Notebook
              </button>
              <span className="page__crumb">
                Created {formatDate(active.createdAt)}
              </span>
              <div className="page__tools">
                <button
                  className="tool tool--danger"
                  onClick={deleteActive}
                >
                  Tear out
                </button>
              </div>
            </div>

            <div className="sheet">
              <div className="sheet__inner">
                <input
                  ref={titleRef}
                  className="title-field"
                  placeholder="Title"
                  value={active.title}
                  onChange={(e) => updateActive({ title: e.target.value })}
                  aria-label="Note title"
                />
                <textarea
                  className="body-field"
                  placeholder="Start writing. The lines are only a suggestion."
                  value={active.body}
                  onChange={(e) => updateActive({ body: e.target.value })}
                  aria-label="Note body"
                />
              </div>
            </div>

            <div className="page__foot">
              <span>
                <b>{wordCount(active.body)}</b> words
              </span>
              <span>
                <b>{active.body.length}</b> characters
              </span>
              <span>Edited {formatDate(active.updatedAt)}</span>
            </div>
          </>
        ) : (
          <div className="blank">
            <div className="blank__mark">✶</div>
            <h2>No page open</h2>
            <p>
              Pick a note from the cover, or start a fresh one. Whatever you
              type saves itself.
            </p>
            <button className="new-btn" onClick={createNote}>
              <span>+</span> New note
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Search() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
