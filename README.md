# Composition - a Next.js notes app

A note-taking app styled after a composition notebook: a marbled cover for the
list, and a real ruled page (blue rules + red margin line) to write on. Notes
persist locally in your browser via `localStorage`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Features

- **Write / Read toggle** - write on ruled paper; flip to Read to see your
  markdown typeset on a clean page (powered by `react-markdown` + `remark-gfm`).
- **Tags** - add tags under any title, then filter the notebook by tag from the
  cover. Press Enter or comma to add; Backspace on an empty input removes the last.
- **Light / dark cover** - flip the cover from the top corner; the choice is
  remembered.
- **Search, autosave, live stats** - full-text search across titles, bodies, and
  tags; every keystroke saves; word/character counts update live.

## Structure

```
app/
  layout.tsx      # loads Fraunces / Newsreader / JetBrains Mono via next/font
  page.tsx        # renders the client component
  globals.css     # all styling: themeable cover, ruled page, prose, tags
components/
  NotesApp.tsx    # client component: CRUD, tags, search, markdown, theme
lib/
  notes.ts        # types + localStorage helpers + tag/theme utilities
```

## Design

- **Palette** - cover `#15130F` (or light `#E8E1D0`), paper `#FAF7EF`,
  blue rule `#AEC2D7`, red margin `#CC7166`, ink-blue accent `#34607E`.
- **Type** - Fraunces (wordmark + titles + markdown headings), Newsreader (the
  writing surface), JetBrains Mono (dates, counts, tags, labels).
- **Signature** - the editor is the page: a repeating `linear-gradient` draws the
  blue rules at the same rhythm as the text's line-height (`--line: 34px`), and a
  second gradient paints the red margin line. The Write view is handwriting on
  rules; the Read view is the same note "printed" - clean, no rules.

Quality floor: responsive to a single mobile pane, visible keyboard focus, and
`prefers-reduced-motion` respected. Cover colors are driven by a small set of
`--cover-*` variables swapped by `[data-theme]`, so theming stays one place.
