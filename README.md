# Composition — a Next.js notes app

A note-taking app styled after a composition notebook: a marbled dark cover for
the list, and a real ruled page (blue rules + red margin line) to write on.
Notes persist locally in your browser via `localStorage`.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## What's inside

```
app/
  layout.tsx      # loads Fraunces / Newsreader / JetBrains Mono via next/font
  page.tsx        # renders the client component
  globals.css     # all the styling (tokens, ruled page, marbled cover)
components/
  NotesApp.tsx    # client component: CRUD, search, autosave, live stats
lib/
  notes.ts        # types + localStorage helpers + word count
```

## Design

- **Palette** — cover `#15130F`, paper `#FAF7EF`, blue rule `#AEC2D7`,
  red margin `#CC7166`, ink-blue accent `#34607E`.
- **Type** — Fraunces (wordmark + titles), Newsreader (the writing surface),
  JetBrains Mono (dates, counts, labels).
- **Signature** — the editor is the page: a repeating `linear-gradient` draws the
  blue rules at the same rhythm as the text's line-height (`--line: 34px`), and a
  second gradient paints the red margin line. Text is written *on* the rules.

Built to a quality floor: responsive down to a single mobile pane, visible
keyboard focus, and `prefers-reduced-motion` respected.
