"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GraphView from "@/components/GraphView";
import {
  Note,
  Notebook,
  Theme,
  allTags,
  backlinks,
  deleteTagIn,
  emptyNote,
  findByTitle,
  formatDate,
  linkifyWiki,
  loadStore,
  loadTheme,
  newNotebook,
  normalizeTag,
  renameTagIn,
  saveNotebooks,
  saveNotes,
  saveTheme,
  snippet,
  wordCount,
} from "@/lib/notes";

type Mode = "write" | "read";
const ALL = "all";

export default function NotesApp() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string>(ALL);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("read");
  const [theme, setTheme] = useState<Theme>("dark");
  const [view, setView] = useState<"list" | "page">("list");

  const [tagInput, setTagInput] = useState("");
  const [nbMenuOpen, setNbMenuOpen] = useState(false);
  const [newNbName, setNewNbName] = useState("");
  const [editingNbId, setEditingNbId] = useState<string | null>(null);
  const [nbDraft, setNbDraft] = useState("");
  const [tagMgrOpen, setTagMgrOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  const [ready, setReady] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  const [ac, setAc] = useState<{
    open: boolean;
    start: number;
    items: AcItem[];
    index: number;
    top: number;
    left: number;
  }>({ open: false, start: 0, items: [], index: 0, top: 0, left: 0 });

  useEffect(() => {
    const { notebooks, notes } = loadStore();
    setNotebooks(notebooks);
    setNotes(notes);
    setActiveId(
      [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null,
    );
    setTheme(loadTheme());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveNotes(notes);
  }, [notes, ready]);
  useEffect(() => {
    if (ready) saveNotebooks(notebooks);
  }, [notebooks, ready]);
  useEffect(() => {
    if (ready) saveTheme(theme);
  }, [theme, ready]);

  // restore caret after a programmatic body edit (wiki-link insert)
  useEffect(() => {
    if (pendingCaret.current != null && bodyRef.current) {
      const p = pendingCaret.current;
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(p, p);
      pendingCaret.current = null;
    }
  });

  const active = useMemo(
    () => notes.find((n) => n.id === activeId) ?? null,
    [notes, activeId],
  );
  const tags = useMemo(() => allTags(notes), [notes]);
  const currentNotebookName =
    activeNotebookId === ALL
      ? "All notes"
      : (notebooks.find((n) => n.id === activeNotebookId)?.name ?? "All notes");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
    if (activeNotebookId !== ALL)
      list = list.filter((n) => n.notebookId === activeNotebookId);
    if (tagFilter) list = list.filter((n) => n.tags.includes(tagFilter));
    if (q)
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((t) => t.includes(q)),
      );
    return list;
  }, [notes, activeNotebookId, tagFilter, query]);

  const backlinkList = useMemo(
    () => (active ? backlinks(notes, active) : []),
    [notes, active],
  );

  /* ---------- notes ---------- */
  function targetNotebookId() {
    return activeNotebookId === ALL ? notebooks[0]?.id : activeNotebookId;
  }

  function createNote() {
    const nbId = targetNotebookId();
    if (!nbId) return;
    const n = emptyNote(nbId);
    setNotes((prev) => [n, ...prev]);
    setActiveId(n.id);
    setMode("write");
    setView("page");
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function updateActive(patch: Partial<Note>) {
    if (!active) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    );
  }

  function deleteActive() {
    if (!active) return;
    const remaining = notes.filter((n) => n.id !== active.id);
    setNotes(remaining);
    setActiveId(
      [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null,
    );
    setView("list");
  }

  function openNote(id: string) {
    setActiveId(id);
    setView("page");
  }

  /* ---------- tags on the active note ---------- */
  function commitTags() {
    if (!active) return;
    const additions = tagInput.split(",").map(normalizeTag).filter(Boolean);
    if (additions.length) {
      updateActive({
        tags: Array.from(new Set([...active.tags, ...additions])),
      });
    }
    setTagInput("");
  }
  function removeTag(tag: string) {
    if (!active) return;
    updateActive({ tags: active.tags.filter((t) => t !== tag) });
  }

  /* ---------- tag manager (all notes) ---------- */
  function doRenameTag(from: string) {
    const to = normalizeTag(tagDraft);
    if (to && to !== from) {
      setNotes((prev) => renameTagIn(prev, from, to));
      if (tagFilter === from) setTagFilter(to);
    }
    setRenamingTag(null);
    setTagDraft("");
  }
  function doDeleteTag(tag: string) {
    setNotes((prev) => deleteTagIn(prev, tag));
    if (tagFilter === tag) setTagFilter(null);
  }

  /* ---------- notebooks ---------- */
  function selectNotebook(id: string) {
    setActiveNotebookId(id);
    setNbMenuOpen(false);
    setTagFilter(null);
    const scope = id === ALL ? notes : notes.filter((n) => n.notebookId === id);
    if (active && !scope.some((n) => n.id === active.id)) {
      setActiveId(
        [...scope].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null,
      );
    }
  }
  function addNotebook() {
    const name = newNbName.trim();
    if (!name) return;
    const nb = newNotebook(name);
    setNotebooks((prev) => [...prev, nb]);
    setNewNbName("");
    selectNotebook(nb.id);
  }
  function renameNotebook(id: string) {
    const name = nbDraft.trim();
    if (name)
      setNotebooks((prev) =>
        prev.map((n) => (n.id === id ? { ...n, name } : n)),
      );
    setEditingNbId(null);
    setNbDraft("");
  }
  function deleteNotebook(id: string) {
    if (notebooks.length <= 1) return;
    const fallback = notebooks.find((n) => n.id !== id)!.id;
    setNotes((prev) =>
      prev.map((n) =>
        n.notebookId === id ? { ...n, notebookId: fallback } : n,
      ),
    );
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
    if (activeNotebookId === id) setActiveNotebookId(ALL);
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  /* ---------- wiki-link autocomplete ---------- */
  function acClose() {
    setAc((a) => (a.open ? { ...a, open: false } : a));
  }

  function wikiCandidates(query: string): AcItem[] {
    const q = query.trim().toLowerCase();
    const titles = Array.from(
      new Set(
        notes
          .filter((n) => n.id !== activeId && n.title.trim())
          .map((n) => n.title.trim()),
      ),
    );
    let matches = q
      ? titles.filter((t) => t.toLowerCase().includes(q))
      : titles;
    matches.sort((a, b) => {
      const aw = a.toLowerCase().startsWith(q) ? 0 : 1;
      const bw = b.toLowerCase().startsWith(q) ? 0 : 1;
      return aw - bw || a.localeCompare(b);
    });
    const items: AcItem[] = matches
      .slice(0, 6)
      .map((label) => ({ type: "link", label }));
    const exact = q && titles.some((t) => t.toLowerCase() === q);
    if (q && !exact) items.push({ type: "new", label: query.trim() });
    return items;
  }

  function refreshAC() {
    const el = bodyRef.current;
    if (!el || mode !== "write") return acClose();
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const open = before.lastIndexOf("[[");
    if (open === -1) return acClose();
    const between = before.slice(open + 2);
    if (between.includes("]") || between.includes("\n")) return acClose();
    const items = wikiCandidates(between);
    if (!items.length) return acClose();
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 34;
    const c = caretCoords(el, open + 2);
    setAc({
      open: true,
      start: open + 2,
      items,
      index: 0,
      top: el.offsetTop + c.top - el.scrollTop + lh,
      left: el.offsetLeft + c.left,
    });
  }

  function insertWiki(item: AcItem) {
    const el = bodyRef.current;
    if (!el || !active) return;
    const pos = el.selectionStart ?? 0;
    const value = el.value;
    const insert = item.label + "]]";
    const next = value.slice(0, ac.start) + insert + value.slice(pos);
    updateActive({ body: next });
    pendingCaret.current = ac.start + insert.length;
    acClose();
  }

  function onBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!ac.open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAc((a) => ({ ...a, index: (a.index + 1) % a.items.length }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAc((a) => ({
        ...a,
        index: (a.index - 1 + a.items.length) % a.items.length,
      }));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertWiki(ac.items[ac.index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      acClose();
    }
  }

  const AC_NAV = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];
  function onBodyKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ac.open && AC_NAV.includes(e.key)) return;
    refreshAC();
  }

  /* ---------- wiki-links ---------- */
  function openByTitle(title: string) {
    const found = findByTitle(notes, title);
    if (found) {
      setActiveNotebookId(found.notebookId);
      setActiveId(found.id);
      setMode("read");
      setView("page");
    } else {
      const nbId = targetNotebookId();
      if (!nbId) return;
      const n = { ...emptyNote(nbId), title };
      setNotes((prev) => [n, ...prev]);
      setActiveId(n.id);
      setMode("write");
      setView("page");
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }

  return (
    <div className="app" data-view={view} data-theme={theme}>
      {/* ---------- the marbled cover ---------- */}
      <aside className="cover">
        <div className="cover__head">
          <div className="cover__headrow">
            <div className="nbselect">
              <button
                className="nbselect__btn"
                onClick={() => setNbMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={nbMenuOpen}
              >
                <span className="label">Notebook</span>
                <span className="nbselect__name">
                  {currentNotebookName} <Chevron />
                </span>
              </button>
              <h1 className="wordmark">
                Composition<em>.</em>
              </h1>
            </div>
            <div className="cover__actions">
              <button
                className="theme-toggle has-tip"
                onClick={() => setMapOpen(true)}
                aria-label="Open note map"
                data-tip="Open the map"
              >
                <MapIcon />
              </button>
              <button
                className="theme-toggle has-tip"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} cover`}
                data-tip={theme === "dark" ? "Light cover" : "Dark cover"}
              >
                {theme === "dark" ? <Sun /> : <Moon />}
              </button>
            </div>
          </div>

          {nbMenuOpen && (
            <>
              <button
                className="backdrop"
                aria-label="Close menu"
                onClick={() => setNbMenuOpen(false)}
              />
              <div className="nbmenu" role="menu">
                <button
                  className={`nbmenu__row${activeNotebookId === ALL ? " is-active" : ""}`}
                  onClick={() => selectNotebook(ALL)}
                >
                  All notes
                  <span className="nbmenu__count">{notes.length}</span>
                </button>
                <div className="nbmenu__divider" />
                {notebooks.map((nb) => (
                  <div
                    key={nb.id}
                    className={`nbmenu__row${activeNotebookId === nb.id ? " is-active" : ""}`}
                  >
                    {editingNbId === nb.id ? (
                      <input
                        className="nbmenu__edit"
                        value={nbDraft}
                        autoFocus
                        onChange={(e) => setNbDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameNotebook(nb.id);
                          if (e.key === "Escape") {
                            setEditingNbId(null);
                            setNbDraft("");
                          }
                        }}
                        onBlur={() => renameNotebook(nb.id)}
                      />
                    ) : (
                      <button
                        className="nbmenu__name"
                        onClick={() => selectNotebook(nb.id)}
                      >
                        {nb.name}
                        <span className="nbmenu__count">
                          {notes.filter((n) => n.notebookId === nb.id).length}
                        </span>
                      </button>
                    )}
                    <span className="nbmenu__actions">
                      <button
                        aria-label={`Rename ${nb.name}`}
                        onClick={() => {
                          setEditingNbId(nb.id);
                          setNbDraft(nb.name);
                        }}
                      >
                        <Pencil />
                      </button>
                      {notebooks.length > 1 && (
                        <button
                          aria-label={`Delete ${nb.name}`}
                          onClick={() => deleteNotebook(nb.id)}
                        >
                          <Trash />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
                <div className="nbmenu__divider" />
                <div className="nbmenu__new">
                  <input
                    placeholder="New notebook"
                    value={newNbName}
                    onChange={(e) => setNewNbName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addNotebook();
                    }}
                  />
                  <button onClick={addNotebook} aria-label="Add notebook">
                    +
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="search">
          <Glass />
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

        {tags.length > 0 && (
          <div className="tagsection">
            <div className="tagsection__head">
              <span>Tags</span>
              <button className="linkbtn" onClick={() => setTagMgrOpen(true)}>
                manage
              </button>
            </div>
            <div className="tagrow" role="group" aria-label="Filter by tag">
              <button
                className={`chip${tagFilter === null ? " chip--on" : ""}`}
                onClick={() => setTagFilter(null)}
              >
                All
              </button>
              {tags.map((t) => (
                <button
                  key={t}
                  className={`chip${tagFilter === t ? " chip--on" : ""}`}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <nav className="list" aria-label="Notes">
          <div className="list__heading">
            {tagFilter
              ? `${filtered.length} tagged \u201c${tagFilter}\u201d`
              : `${filtered.length} pages`}
          </div>
          {filtered.length === 0 ? (
            <p className="list__empty">
              {query || tagFilter || activeNotebookId !== ALL
                ? "Nothing here yet. Clear a filter, or start a page."
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
                  className={`entry__title${n.title.trim() ? "" : " entry__title--empty"}`}
                >
                  {n.title.trim() || "Untitled"}
                </p>
                {snippet(n.body) && (
                  <p className="entry__snippet">{snippet(n.body)}</p>
                )}
                {n.tags.length > 0 && (
                  <div className="entry__tags">
                    {n.tags.slice(0, 3).map((t) => (
                      <span key={t} className="minitag">
                        {t}
                      </span>
                    ))}
                  </div>
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
                <div className="seg" role="group" aria-label="View mode">
                  <button
                    aria-pressed={mode === "write"}
                    onClick={() => setMode("write")}
                  >
                    Write
                  </button>
                  <button
                    aria-pressed={mode === "read"}
                    onClick={() => setMode("read")}
                  >
                    Read
                  </button>
                </div>
                <button className="tool tool--danger" onClick={deleteActive}>
                  Tear out
                </button>
              </div>
            </div>

            <div className="sheet">
              <div className="sheet__inner">
                {mode === "write" ? (
                  <>
                    <input
                      ref={titleRef}
                      className="title-field"
                      placeholder="Title"
                      value={active.title}
                      onChange={(e) => updateActive({ title: e.target.value })}
                      aria-label="Note title"
                    />
                    <div className="tag-edit">
                      {active.tags.map((t) => (
                        <span key={t} className="tag">
                          {t}
                          <button
                            onClick={() => removeTag(t)}
                            aria-label={`Remove tag ${t}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        className="tag-input"
                        placeholder={
                          active.tags.length ? "add tag" : "add a tag…"
                        }
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            commitTags();
                          } else if (
                            e.key === "Backspace" &&
                            !tagInput &&
                            active.tags.length
                          ) {
                            removeTag(active.tags[active.tags.length - 1]);
                          }
                        }}
                        onBlur={commitTags}
                        aria-label="Add a tag"
                      />
                    </div>
                    <div className="editor-wrap">
                      <textarea
                        ref={bodyRef}
                        className="body-field"
                        placeholder="Start writing. Markdown welcome — link pages with [[Title]]."
                        value={active.body}
                        onChange={(e) => updateActive({ body: e.target.value })}
                        onKeyDown={onBodyKeyDown}
                        onKeyUp={onBodyKeyUp}
                        onClick={refreshAC}
                        onBlur={() => acClose()}
                        aria-label="Note body"
                      />
                      {ac.open && (
                        <ul
                          className="ac"
                          style={{ top: ac.top, left: ac.left }}
                          role="listbox"
                        >
                          {ac.items.map((it, i) => (
                            <li
                              key={it.type + it.label}
                              role="option"
                              aria-selected={i === ac.index}
                              className={`ac__item${i === ac.index ? " is-active" : ""}${
                                it.type === "new" ? " ac__item--new" : ""
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                insertWiki(it);
                              }}
                              onMouseEnter={() =>
                                setAc((a) => ({ ...a, index: i }))
                              }
                            >
                              {it.type === "new" ? (
                                <>Create “{it.label}”</>
                              ) : (
                                it.label
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <article className="read">
                    <h1 className="read__title">
                      {active.title.trim() || "Untitled"}
                    </h1>
                    {active.tags.length > 0 && (
                      <div className="read__tags">
                        {active.tags.map((t) => (
                          <span key={t} className="minitag minitag--paper">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {active.body.trim() ? (
                      <div className="prose">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ href, children, ...props }) => {
                              if (href && href.startsWith("wiki:")) {
                                const title = decodeURIComponent(href.slice(5));
                                const exists = !!findByTitle(notes, title);
                                return (
                                  <a
                                    href="#"
                                    className={`wikilink${exists ? "" : " wikilink--new"}`}
                                    title={
                                      exists
                                        ? `Go to "${title}"`
                                        : `Create "${title}"`
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      openByTitle(title);
                                    }}
                                  >
                                    {children}
                                  </a>
                                );
                              }
                              return (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  {...props}
                                >
                                  {children}
                                </a>
                              );
                            },
                          }}
                        >
                          {linkifyWiki(active.body)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="read__empty">
                        This page is blank. Switch to Write to fill it.
                      </p>
                    )}
                  </article>
                )}

                {backlinkList.length > 0 && (
                  <div className="backlinks">
                    <div className="backlinks__head">Linked from</div>
                    {backlinkList.map((n) => (
                      <button
                        key={n.id}
                        className="backlinks__item"
                        onClick={() => openNote(n.id)}
                      >
                        ← {n.title.trim() || "Untitled"}
                      </button>
                    ))}
                  </div>
                )}
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

      {/* ---------- tag manager ---------- */}
      {tagMgrOpen && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Manage tags"
        >
          <button
            className="modal__backdrop"
            aria-label="Close"
            onClick={() => setTagMgrOpen(false)}
          />
          <div className="modal__panel">
            <div className="modal__head">
              <h2>Manage tags</h2>
              <button
                className="modal__x"
                onClick={() => setTagMgrOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {tags.length === 0 ? (
              <p className="modal__empty">No tags yet. Add some from a note.</p>
            ) : (
              <ul className="taglist">
                {tags.map((t) => (
                  <li key={t} className="taglist__row">
                    {renamingTag === t ? (
                      <input
                        className="taglist__edit"
                        value={tagDraft}
                        autoFocus
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") doRenameTag(t);
                          if (e.key === "Escape") {
                            setRenamingTag(null);
                            setTagDraft("");
                          }
                        }}
                        onBlur={() => doRenameTag(t)}
                      />
                    ) : (
                      <span className="taglist__name">
                        {t}
                        <span className="taglist__count">
                          {notes.filter((n) => n.tags.includes(t)).length}
                        </span>
                      </span>
                    )}
                    <span className="taglist__actions">
                      <button
                        onClick={() => {
                          setRenamingTag(t);
                          setTagDraft(t);
                        }}
                      >
                        rename
                      </button>
                      <button
                        className="is-danger"
                        onClick={() => doDeleteTag(t)}
                      >
                        delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="modal__hint">
              Rename a tag onto an existing one to merge them.
            </p>
          </div>
        </div>
      )}

      {/* ---------- the map ---------- */}
      {mapOpen && (
        <GraphView
          notes={notes}
          notebooks={notebooks}
          activeId={activeId}
          onClose={() => setMapOpen(false)}
          onOpen={(id) => {
            const n = notes.find((x) => x.id === id);
            if (n) setActiveNotebookId(n.notebookId);
            setActiveId(id);
            setMode("read");
            setView("page");
            setMapOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------- wiki autocomplete support ---------- */
type AcItem = { type: "link" | "new"; label: string };

const CARET_PROPS = [
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
  "tabSize",
];

/** Pixel offset of a character position inside a textarea (mirror-div technique). */
function caretCoords(
  el: HTMLTextAreaElement,
  pos: number,
): { top: number; left: number } {
  const cs = getComputedStyle(el);
  const div = document.createElement("div");
  for (const p of CARET_PROPS) (div.style as any)[p] = (cs as any)[p];
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflowWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.style.width = el.clientWidth + "px";
  div.style.boxSizing = "border-box";
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = el.value.slice(pos) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop;
  const left = span.offsetLeft;
  document.body.removeChild(div);
  return { top, left };
}

/* ---------- inline icons ---------- */
function Glass() {
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
function Chevron() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function Pencil() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function Trash() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function Sun() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function Moon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="13" cy="18" r="2.4" />
      <path d="M8 8.2l3.2 8M16.5 8l-3 8.2M8 6.6l8 -0.4" />
    </svg>
  );
}
