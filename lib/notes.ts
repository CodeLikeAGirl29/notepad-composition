export type Note = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  notebookId: string;
  createdAt: number;
  updatedAt: number;
};

export type Notebook = {
  id: string;
  name: string;
  createdAt: number;
};

export type Theme = "dark" | "light";

const KEY_NOTES = "composition.notes.v1";
const KEY_NOTEBOOKS = "composition.notebooks.v1";
const KEY_THEME = "composition.theme.v1";

const DEFAULT_NOTEBOOK = "Notebook \u2116 1";

/* ---------- small helpers ---------- */

export function uid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  );
}

export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function snippet(body: string, max = 88): string {
  const clean = body
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // show wiki-link text, not brackets
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.length > max ? clean.slice(0, max).trimEnd() + "\u2026" : clean;
}

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 24);
}

export function allTags(notes: Note[]): string[] {
  const set = new Set<string>();
  for (const n of notes) for (const t of n.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---------- factories ---------- */

export function emptyNote(notebookId: string): Note {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    body: "",
    tags: [],
    notebookId,
    createdAt: now,
    updatedAt: now,
  };
}

export function newNotebook(name: string): Notebook {
  return {
    id: uid(),
    name: name.trim() || "Untitled notebook",
    createdAt: Date.now(),
  };
}

/* ---------- notebooks persistence ---------- */

export function loadNotebooks(): Notebook[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_NOTEBOOKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed as Notebook[];
    }
  } catch {
    /* fall through to default */
  }
  const seed = [newNotebook(DEFAULT_NOTEBOOK)];
  saveNotebooks(seed);
  return seed;
}

export function saveNotebooks(notebooks: Notebook[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_NOTEBOOKS, JSON.stringify(notebooks));
  } catch {
    /* ignore */
  }
}

/* ---------- notes persistence ---------- */

function migrateNote(n: Partial<Note>, fallbackNotebookId: string): Note {
  const now = Date.now();
  return {
    id: typeof n.id === "string" ? n.id : uid(),
    title: typeof n.title === "string" ? n.title : "",
    body: typeof n.body === "string" ? n.body : "",
    tags: Array.isArray(n.tags)
      ? n.tags.filter((t) => typeof t === "string")
      : [],
    notebookId:
      typeof n.notebookId === "string" ? n.notebookId : fallbackNotebookId,
    createdAt: typeof n.createdAt === "number" ? n.createdAt : now,
    updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : now,
  };
}

function seedNotes(notebookId: string): Note[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      title: "On keeping a notebook",
      body: "Every notebook starts the same way \u2014 a blank page and the small dare to fill it.\n\n## How this one works\n\n- Switch to **Read** to see your markdown typeset.\n- Add **tags** under the title, and manage them from the cover.\n- Link pages together with [[wiki-links]] \u2014 try clicking one in Read mode.\n\n> The lines are only a suggestion.",
      tags: ["meta", "writing"],
      notebookId,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function loadNotes(fallbackNotebookId: string): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_NOTES);
    if (!raw) {
      const s = seedNotes(fallbackNotebookId);
      saveNotes(s);
      return s;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((n) => migrateNote(n, fallbackNotebookId))
      : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_NOTES, JSON.stringify(notes));
  } catch {
    /* storage full or unavailable - keep working in memory */
  }
}

/** Load notebooks (ensuring at least one) and notes together. */
export function loadStore(): { notebooks: Notebook[]; notes: Note[] } {
  const notebooks = loadNotebooks();
  const notes = loadNotes(notebooks[0].id);
  return { notebooks, notes };
}

/* ---------- theme ---------- */

export function loadTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(KEY_THEME) === "light" ? "light" : "dark";
}

export function saveTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_THEME, theme);
  } catch {
    /* ignore */
  }
}

/* ---------- tag operations (pure) ---------- */

/** Rename a tag everywhere. Renaming onto an existing tag merges them. */
export function renameTagIn(notes: Note[], from: string, to: string): Note[] {
  const target = normalizeTag(to);
  if (!target || target === from) return notes;
  return notes.map((n) => {
    if (!n.tags.includes(from)) return n;
    const next = Array.from(
      new Set(n.tags.map((t) => (t === from ? target : t)))
    );
    return { ...n, tags: next, updatedAt: Date.now() };
  });
}

/** Remove a tag from every note. */
export function deleteTagIn(notes: Note[], tag: string): Note[] {
  return notes.map((n) =>
    n.tags.includes(tag)
      ? { ...n, tags: n.tags.filter((t) => t !== tag), updatedAt: Date.now() }
      : n
  );
}

/* ---------- wiki-links ---------- */

/** Find a note by title (case-insensitive, trimmed). */
export function findByTitle(notes: Note[], title: string): Note | undefined {
  const t = title.trim().toLowerCase();
  if (!t) return undefined;
  return notes.find((n) => n.title.trim().toLowerCase() === t);
}

/** Notes that link to `target` via [[target.title]]. */
export function backlinks(notes: Note[], target: Note): Note[] {
  const title = target.title.trim();
  if (!title) return [];
  const re = new RegExp(`\\[\\[\\s*${escapeRegex(title)}\\s*\\]\\]`, "i");
  return notes.filter((n) => n.id !== target.id && re.test(n.body));
}

/** Titles referenced by [[wiki-links]] in a body, in order, de-duplicated. */
export function extractLinks(body: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const t = m[1].trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Turn [[Title]] into markdown links with a wiki: scheme for click handling. */
export function linkifyWiki(body: string): string {
  return body.replace(/\[\[([^\]]+)\]\]/g, (_m, raw) => {
    const title = String(raw).trim();
    return `[${title}](wiki:${encodeURIComponent(title)})`;
  });
}
