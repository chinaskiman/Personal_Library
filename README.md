# Reading Journal · دفتر مطالعه

A desktop-first, RTL Persian personal reading journal — minimalist editorial
UI built with React, TypeScript, Vite and Tailwind CSS v4.

> The product name ("Reading Journal") is a temporary placeholder.

---

## Running locally

```bash
npm install     # once
npm run dev     # http://localhost:5173
```

| Script              | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR       |
| `npm run build`     | Type-check (`tsc -b`) + production build  |
| `npm run preview`   | Serve the production build locally       |
| `npm run typecheck` | TypeScript only, no emit                 |

---

## Renaming the project

Everything user-facing is driven by **`src/config/app.ts`** — change
`APP_CONFIG.name` / `nameFa` and the sidebar wordmark, footer and page copy
update together. Also update the `<title>` in `index.html`.

The document language and direction live on the `<html>` tag in `index.html`
(`lang="fa" dir="rtl"`) and are mirrored by `DOCUMENT_LANG` / `DOCUMENT_DIR`
in `src/config/app.ts`.

---

## Design system

All tokens are declared once in the `@theme` block of
**`src/styles/index.css`**:

| Token family | Examples                                        |
| ------------ | ----------------------------------------------- |
| Surfaces     | `--color-canvas` `#F7F4ED`, `--color-surface` `#EFE9DF` |
| Borders      | `--color-line` `#D8CABB`                        |
| Accent       | `--color-accent` `#826D55`                      |
| Text         | `--color-ink` `#302A25`, `--color-ink-soft` `#827565` |
| Status       | `--color-status-reading`, `--color-status-finished`, … |
| Type         | `--font-sans` (Vazirmatn), `--font-serif` (Cormorant Garamond) |
| Radii        | `--radius-xs` 2px … `--radius-xl` 14px         |
| Shadows      | `--shadow-paper`, `--shadow-soft`, `--shadow-cover` |
| Layout       | `--spacing-sidebar`, `--spacing-gutter`, `--spacing-topbar` |
| Motion       | `--ease-editorial`                              |

Fonts are bundled locally via `@fontsource` — **no external CDN requests**, so
typography never depends on the network.

---

## RTL / LTR handling

- The document is `dir="rtl"`, so the sidebar docks on the **right** purely
  through logical positioning (`start-0`, `border-e`, `ps-*`) — there is no
  hard-coded `left`/`right` anywhere in the layout.
- The `ltr` utility (`direction: ltr; unicode-bidi: isolate; text-align: start`)
  isolates English runs so book titles, author names and ISBNs read correctly
  without disturbing the surrounding Persian text.
- The sidebar collapses to a centred icon rail between 768–1023px via
  `--app-sidebar-current`; below 768px a compact horizontal nav bar takes over.

---

## Project structure

```
src/
  components/
    books/      BookCard, BookCover
    common/     GlobalSearch, AddBookButton, StatusBadge, ProgressBar,
                SectionHeading, EmptyState, LtrText
    navigation/ AppSidebar, SidebarNavItem, MobileNavBar, TopBar
  config/       app.ts          ← product name & document direction
  data/         navigation.ts, readingStatus.ts, catalog.ts
  layouts/      AppShell.tsx
  lib/          cn.ts, date.ts, format.ts
  pages/        HomePage.tsx, PlaceholderPage.tsx
  styles/       index.css (@theme tokens), fonts.css
  types/        book.ts, navigation.ts, reading.ts
```

---

## Empty by default

**There is no seed data.** The application ships no sample books and no
fabricated reading activity; the library starts empty and contains only what you
add. A previous version merged eight invented books into every view and paired
them with a made-up activity panel — both were removed outright, along with the
`DemoNotice` that labelled them.

`src/data/catalog.ts` is the one remaining placeholder: it backs the add-book
**search** tab as a stand-in for a catalog API. Nothing in it is ever inserted
into your library or persisted.

A one-time reset (`lib/libraryReset.ts`) clears anything an older install left
behind — stored books, notes, overrides and IndexedDB images. It writes a marker
key so it can never re-run, and it never touches the theme preference. Library
keys are rewritten as a valid *empty* state rather than deleted, so the existing
schema and its compatibility safeguards still apply.

Book covers are drawn locally in CSS (`BookCover`) with a deterministic
per-title palette — **no remote image URLs**, and a supplied `coverImage`
degrades gracefully to the placeholder on load failure.

---

## Current scope

This repository is the **initial foundation only**: the design system, the RTL
application shell and the home dashboard.

Deliberately **not** implemented yet — the architecture is prepared for them,
but no backend, database, auth, search API, note editor or analytics logic
exists: the `activeItemId` state in `src/App.tsx` is where a router's location
will slot in, and the data modules are shaped to be replaced by a repository
layer.
