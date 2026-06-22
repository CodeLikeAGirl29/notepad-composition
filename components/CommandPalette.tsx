"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group: "Actions" | "Notebooks" | "Notes";
  keywords?: string;
  run: () => void;
};

/** Subsequence fuzzy match; higher is better, -Infinity means no match. */
function fuzzy(text: string, q: string): number {
  let ti = 0,
    score = 0,
    streak = 0,
    first = -1;
  for (const ch of q) {
    const idx = text.indexOf(ch, ti);
    if (idx === -1) return -Infinity;
    if (first < 0) first = idx;
    if (idx === ti) {
      streak++;
      score += 2 + streak;
    } else {
      streak = 0;
      score += 1;
    }
    ti = idx + 1;
  }
  return score - first * 0.1;
}

export default function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    if (!q) {
      const actions = commands.filter((c) => c.group !== "Notes");
      const recent = commands.filter((c) => c.group === "Notes").slice(0, 6);
      return [...actions, ...recent];
    }
    return commands
      .map((c) => ({
        c,
        s: fuzzy(
          `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase(),
          q,
        ),
      }))
      .filter((x) => x.s !== -Infinity)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.c);
  }, [commands, q]);

  useEffect(() => {
    setIndex(0);
  }, [q]);
  useEffect(() => {
    if (index > items.length - 1) setIndex(Math.max(0, items.length - 1));
  }, [items, index]);

  function run(i: number) {
    const it = items[i];
    if (it) {
      it.run();
      onClose();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(index);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const showGroups = !q;

  return (
    <div
      className="cmdk"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button className="cmdk__backdrop" aria-label="Close" onClick={onClose} />
      <div className="cmdk__panel">
        <input
          className="cmdk__input"
          autoFocus
          placeholder="Search notes or run a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Command palette search"
        />
        <div className="cmdk__list">
          {items.length === 0 ? (
            <div className="cmdk__empty">No matches.</div>
          ) : (
            items.map((it, i) => {
              const header =
                showGroups && (i === 0 || items[i - 1].group !== it.group)
                  ? it.group
                  : null;
              return (
                <div key={it.id}>
                  {header && <div className="cmdk__group">{header}</div>}
                  <button
                    className={`cmdk__item${i === index ? " is-active" : ""}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => run(i)}
                    ref={
                      i === index
                        ? (el) => el?.scrollIntoView({ block: "nearest" })
                        : undefined
                    }
                  >
                    <span className="cmdk__label">{it.label}</span>
                    {it.hint && <span className="cmdk__hint">{it.hint}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="cmdk__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
