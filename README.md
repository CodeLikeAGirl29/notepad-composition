# Composition - A Next.js Notes App

A note-taking app inspired by the classic composition notebook. It features a marbled cover for your note list and a ruled page for writing. All notes are saved directly in your browser using `localStorage`, making it fast, private, and serverless.

## Features

- **Classic Notebook Feel**: A marbled cover lists your notes, and a ruled page with blue rules and a red margin line provides the writing surface.
- **Write & Read Modes**: Jot down notes on ruled paper in "Write" mode, then flip to "Read" mode to see your Markdown (`react-markdown` + `remark-gfm`) rendered on a clean page.
- **Local Persistence**: All notes are stored in your browser's `localStorage`. No accounts, no cloud, just your notes on your machine.
- **Tagging System**: Organize notes with tags. Add/remove tags on any note, then filter the entire notebook by tag from the cover. A tag manager allows for renaming and deleting tags globally.
- **Wiki-links & Backlinks**: Connect your thoughts by creating links between notes using `[[Note Title]]` syntax, with autocomplete for existing titles. Each note automatically shows a list of backlinks from other notes.
- **Note Graph**: Visualize the connections between your notes in an interactive, force-directed graph.
- **Multiple Notebooks**: Group your notes into different notebooks and easily switch between them.
- **Dynamic & Responsive**: Features full-text search across titles, bodies, and tags, autosave on every keystroke, and live word/character counts. The interface is responsive down to a single mobile pane.
- **Theming**: Switch between a light and dark marbled cover. Your preference is saved.

## Getting Started

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Project Structure

```
app/
  layout.tsx      # Loads fonts (Fraunces, Newsreader, JetBrains Mono)
  page.tsx        # Renders the main client component
  globals.css     # All styling: themes, ruled page, prose, tags, etc.
components/
  NotesApp.tsx    # The core client component: state, CRUD, tags, search, wiki-links
  GraphView.tsx   # Renders the interactive note graph with a physics simulation
lib/
  notes.ts        # Data types, localStorage helpers, and utility functions
```

## Design Details

- **Palette**: The cover uses a dark (`#15130F`) or light (`#E8E1D0`) theme. The paper is `#FAF7EF`, with a blue rule (`#AEC2D7`), red margin (`#CC7166`), and an ink-blue accent (`#34607E`).
- **Typography**: Fraunces is used for the wordmark and titles, Newsreader for the main writing surface, and JetBrains Mono for metadata, tags, and labels.
- **The Editor**: The editor is designed to be the page itself. A repeating `linear-gradient` draws the blue rules at the same rhythm as the text's line-height, while a second gradient paints the red margin line. The "Write" view simulates a handwritten experience, while "Read" presents the same note as a clean, typeset page.
