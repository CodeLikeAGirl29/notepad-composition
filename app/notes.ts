export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

const KEY = "composition.notes.v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
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
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

export function emptyNote(): Note {
  const now = Date.now();
  return { id: uid(), title: "", body: "", createdAt: now, updatedAt: now };
}

function seed(): Note[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      title: "First page",
      body:
        "Every notebook starts the same way — a blank page and the small dare to fill it.\n\nWrite here. The lines are only a suggestion.",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      window.localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* storage full or unavailable — keep working in memory */
  }
}
