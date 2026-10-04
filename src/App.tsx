import { useEffect, useMemo, useState } from 'react'

import { AddBookDialog } from '@/components/add-book/AddBookDialog'
import { PersistenceWarning } from '@/components/common/PersistenceWarning'
import { useLibrary } from '@/hooks/useLibrary'
import { useThemePreference } from '@/hooks/useThemePreference'
import { bookMatchesQuery } from '@/lib/library'
import { AppShell } from '@/layouts/AppShell'
import { BookDetailsPage } from '@/pages/BookDetailsPage'
import { HomePage } from '@/pages/HomePage'
import { InsightsPage } from '@/pages/InsightsPage'
import { MyLibraryPage } from '@/pages/MyLibraryPage'
import { NotesLibraryPage } from '@/pages/NotesLibraryPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { SettingsPage } from '@/pages/SettingsPage'
import type { NavItem, NavItemId } from '@/types/navigation'

/**
 * Root of the shell.
 *
 * Routing is intentionally local state for now: `activeItemId` is the single
 * source of truth, exactly where a router's location would slot in later.
 * The library collection and the add-book dialog live here for the same
 * reason — they are the seams a repository and a route will grow from.
 */
export default function App() {
  const [activeItemId, setActiveItemId] = useState<NavItemId>('home')
  // One search value shared by the top bar, the dashboard and the library.
  const [searchValue, setSearchValue] = useState('')
  const [isAddBookOpen, setIsAddBookOpen] = useState(false)
  // The open book, if any. Rendered over the current destination so the detail
  // view is a mode rather than a route — a router can replace this later.
  const [openBookId, setOpenBookId] = useState<string | null>(null)
  // Note to reveal inside the open book, set when arriving from Notes library.
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null)
  const {
    books,
    counts,
    notes,
    notesByBook,
    persisted,
    userBooks,
    overrides,
    addBook,
    updateBook,
    setBookStatus,
    deleteBook,
    addNote,
    updateNote,
    deleteNote,
    importRecords,
    clearUserData,
  } = useLibrary()

  // Mounted here, not inside Settings: the preference has to stay live for the
  // whole session, otherwise the page would only follow the OS in `system` mode
  // while the user happened to be on that screen.
  const { preference: themePreference, setPreference: onThemeChange } = useThemePreference()

  // The dashboard and the library read the same collection, so a book added,
  // edited or deleted in one is visible in the other without extra plumbing.
  const visibleBooks = useMemo(
    () => books.filter((book) => bookMatchesQuery(book, searchValue)),
    [books, searchValue],
  )

  // Opening a book normally clears any pending note focus, so the highlight from
// an earlier jump does not linger on the next book.
const openBookFrom = (bookId: string, noteId?: string) => {
  setOpenBookId(bookId)
  setFocusNoteId(noteId ?? null)
}

const openBook = books.find((book) => book.id === openBookId)
  const selectedBook = openBookId && openBook ? openBook : null

  // A book removed (or never found) must not leave the detail view stranded.
  // Done in an effect rather than during render, which React disallows.
  useEffect(() => {
    if (openBookId && !openBook) setOpenBookId(null)
  }, [openBookId, openBook])

  const handleNavigate = useMemo(
    () => (item: NavItem) => {
      setActiveItemId(item.id as NavItemId)
      // Leaving a detail view when navigating keeps the shell predictable.
      setOpenBookId(null)
      setFocusNoteId(null)
    },
    [],
  )

  const openAddBook = useMemo(() => () => setIsAddBookOpen(true), [])

  // Plain book opens (library grid, insights, recent activity) never focus a note.
  const openBookPlain = useMemo(() => (bookId: string) => openBookFrom(bookId), [])

  return (
    <>
      <AppShell
        activeItemId={activeItemId}
        onNavigate={handleNavigate}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onAddBook={openAddBook}
      >
        {selectedBook ? (
          <BookDetailsPage
            book={selectedBook}
            notes={notesByBook[selectedBook.id] ?? []}
            onBack={() => setOpenBookId(null)}
            onUpdateBook={updateBook}
            onSetStatus={setBookStatus}
            onDeleteBook={deleteBook}
            onCreateNote={(bookId, draft) => addNote({ bookId, ...draft })}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            focusNoteId={focusNoteId}
          />
        ) : activeItemId === 'home' ? (
          <HomePage
            books={visibleBooks}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onAddBook={openAddBook}
          />
        ) : activeItemId === 'library' ? (
          <MyLibraryPage
            books={books}
            counts={counts}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onAddBook={openAddBook}
            onOpenBook={openBookPlain}
          />
        ) : activeItemId === 'insights' ? (
          // Insights reads the whole collection rather than the search-filtered
          // subset: the figures describe the library, not one query's results.
          <InsightsPage
            books={books}
            notes={notes}
            onOpenBook={openBookPlain}
          />
        ) : activeItemId === 'settings' ? (
          // Settings reads the raw user records rather than the composed
          // collection, because a backup must not contain the bundled samples.
          <SettingsPage
            themePreference={themePreference}
            onThemeChange={onThemeChange}
            userBooks={userBooks}
            overrides={overrides}
            notes={notes}
            onImport={importRecords}
            onClear={clearUserData}
            persisted={persisted}
          />
        ) : activeItemId === 'notes' || activeItemId === 'quotes' ? (
          // One page serves both destinations: "Quotes" simply opens the same
          // collection with the quote filter pre-applied, rather than shipping
          // a second near-identical list.
          <NotesLibraryPage
            notes={notes}
            books={books}
            onOpenBook={openBookPlain}
            onOpenNote={openBookFrom}
            onDeleteNote={deleteNote}
            initialType={activeItemId === 'quotes' ? 'quote' : 'all'}
          />
        ) : (
          <PlaceholderPage itemId={activeItemId} />
        )}

        {/* Storage failures are silent by design so a private-mode browser does
            not throw mid-render; this is where the user finally finds out. */}
        <PersistenceWarning visible={!persisted} />
      </AppShell>

      {/* Rendered at the shell level so the top-bar button and the library
          page's button both drive the same dialog. */}
      <AddBookDialog
        open={isAddBookOpen}
        onClose={() => setIsAddBookOpen(false)}
        books={books}
        onAdd={addBook}
      />
    </>
  )
}
