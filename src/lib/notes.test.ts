/**
 * Focused checks on the notes-library search, filtering and sorting.
 *
 * Runs on Node's built-in runner with native type stripping, so no dependency is
 * added. The emphasis is on the rules that are easy to get subtly wrong:
 * Persian normalisation, page-number matching, and sort stability.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  booksWithNotes,
  countByType,
  latinizeDigits,
  noteMatchesQuery,
  selectNotes,
  sortNotes,
  type NoteQuery,
} from './notes.ts'
import type { Book } from '../types/book.ts'
import type { Note } from '../types/note.ts'

function book(id: string, title: string, author = 'Anon'): Book {
  return {
    id,
    title,
    author,
    status: 'reading',
    shelf: 'personal',
    progress: 0.3,
    lastAccessedAt: '2026-03-01T00:00:00.000Z',
    origin: 'user',
  }
}

function note(id: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    bookId: 'b1',
    type: 'text',
    content: 'entry',
    createdAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

const QUERY: NoteQuery = {
  search: '',
  type: 'all',
  bookId: null,
  pageRef: 'any',
  sort: 'newest',
}

describe('latinizeDigits', () => {
  it('folds Persian and Arabic-Indic digits to Latin', () => {
    assert.equal(latinizeDigits('۱۲۳'), '123')
    assert.equal(latinizeDigits('٤٥٦'), '456')
    assert.equal(latinizeDigits('no digits'), 'no digits')
  })
})

describe('noteMatchesQuery', () => {
  const b1 = book('b1', 'The Left Hand of Darkness', 'Ursula K. Le Guin')

  it('matches Latin case-insensitively', () => {
    const n = note('n1', { content: 'A Remarkable Passage' })
    assert.equal(noteMatchesQuery(n, 'remarkable', b1), true)
    assert.equal(noteMatchesQuery(n, 'REMARKABLE', b1), true)
  })

  it('matches Persian text ignoring ZWNJ and letter variants', () => {
    const n = note('n1', { content: 'می‌خواهم دوباره بخوانم' })
    assert.equal(noteMatchesQuery(n, 'میخواهم', b1), true)
  })

  it('matches on the book title and author', () => {
    const n = note('n1', { content: 'unrelated words' })
    assert.equal(noteMatchesQuery(n, 'Le Guin', b1), true)
    assert.equal(noteMatchesQuery(n, 'left hand', b1), true)
    assert.equal(noteMatchesQuery(n, 'not present', b1), false)
  })

  it('matches a page number in either digit form', () => {
    const n = note('n1', { content: 'x', page: 12 })
    assert.equal(noteMatchesQuery(n, '۱۲', b1), true)
    assert.equal(noteMatchesQuery(n, '12', b1), true)
    assert.equal(noteMatchesQuery(n, '13', b1), false)
  })

  it('does not match a bare digit as a prefix of another page', () => {
    const n = note('n1', { content: 'x', page: 120 })
    // «۱» must not match page 120.
    assert.equal(noteMatchesQuery(n, '۱', b1), false)
  })

  it('treats an empty or whitespace query as matching everything', () => {
    assert.equal(noteMatchesQuery(note('n1'), '', b1), true)
    assert.equal(noteMatchesQuery(note('n1'), '   ', b1), true)
  })

  it('ignores surrounding whitespace on the query', () => {
    const n = note('n1', { content: 'کتاب خوبی بود' })
    assert.equal(noteMatchesQuery(n, '  کتاب  ', b1), true)
  })

  it('survives a missing book', () => {
    const n = note('n1', { content: 'still findable' })
    assert.equal(noteMatchesQuery(n, 'findable', null), true)
  })
})

describe('selectNotes filters', () => {
  const books = [book('b1', 'Alpha'), book('b2', 'Beta')]
  const notes = [
    note('n1', { bookId: 'b1', type: 'text', content: 'alpha note' }),
    note('n2', { bookId: 'b1', type: 'quote', content: 'alpha quote', page: 10 }),
    note('n3', { bookId: 'b2', type: 'image', content: 'beta image' }),
  ]

  it('returns everything with no constraints', () => {
    assert.equal(selectNotes(notes, books, QUERY).length, 3)
  })

  it('filters by type', () => {
    const quotes = selectNotes(notes, books, { ...QUERY, type: 'quote' })
    assert.deepEqual(quotes.map((n) => n.id), ['n2'])
  })

  it('filters by book', () => {
    assert.deepEqual(
      selectNotes(notes, books, { ...QUERY, bookId: 'b2' }).map((n) => n.id),
      ['n3'],
    )
  })

  it('filters by page-reference presence', () => {
    assert.deepEqual(
      selectNotes(notes, books, { ...QUERY, pageRef: 'with' }).map((n) => n.id),
      ['n2'],
    )
    assert.equal(selectNotes(notes, books, { ...QUERY, pageRef: 'without' }).length, 2)
  })

  it('combines filters conjunctively', () => {
    const result = selectNotes(notes, books, {
      ...QUERY,
      type: 'quote',
      bookId: 'b1',
      search: 'alpha',
    })
    assert.deepEqual(result.map((n) => n.id), ['n2'])

    // Same filters, a search that excludes it -> nothing.
    assert.equal(
      selectNotes(notes, books, { ...QUERY, type: 'quote', bookId: 'b1', search: 'zzz' })
        .length,
      0,
    )
  })

  it('yields nothing for a book id that no longer exists', () => {
    // A stale filter must not quietly fall back to the whole library.
    assert.equal(selectNotes(notes, books, { ...QUERY, bookId: 'ghost' }).length, 0)
  })

  it('does not mutate the source array', () => {
    const source = [...notes]
    selectNotes(source, books, { ...QUERY, sort: 'oldest' })
    assert.deepEqual(source, notes)
  })
})

describe('sortNotes', () => {
  const older = note('a-old', { createdAt: '2026-01-01T00:00:00.000Z' })
  const newer = note('b-new', { createdAt: '2026-03-01T00:00:00.000Z' })

  it('orders newest and oldest first', () => {
    assert.deepEqual(sortNotes([older, newer], 'newest').map((n) => n.id), [
      'b-new',
      'a-old',
    ])
    assert.deepEqual(sortNotes([newer, older], 'oldest').map((n) => n.id), [
      'a-old',
      'b-new',
    ])
  })

  it('is stable for identical timestamps (tie-broken by id)', () => {
    const same = '2026-02-02T00:00:00.000Z'
    const list = [
      note('zz', { createdAt: same }),
      note('aa', { createdAt: same }),
      note('mm', { createdAt: same }),
    ]
    const first = sortNotes(list, 'newest').map((n) => n.id)
    const second = sortNotes([...list].reverse(), 'newest').map((n) => n.id)
    assert.deepEqual(first, ['aa', 'mm', 'zz'])
    // Input order must not change the outcome.
    assert.deepEqual(second, first)
  })

  it('sorts undated and malformed-timestamp notes last, not first', () => {
    const list = [
      note('bad', { createdAt: 'not-a-date' }),
      note('ok', { createdAt: '2026-03-01T00:00:00.000Z' }),
      note('gone', { createdAt: '' }),
    ]
    assert.equal(sortNotes(list, 'newest')[0]?.id, 'ok')
  })

  it('sorts by most recent edit, falling back to creation', () => {
    const list = [
      note('edited', {
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
      }),
      note('created', { createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    assert.deepEqual(sortNotes(list, 'recently-updated').map((n) => n.id), [
      'edited',
      'created',
    ])
  })

  it('sorts by book title and puts a missing book last', () => {
    const booksById = new Map([
      ['b2', book('b2', 'Beta')],
      ['b1', book('b1', 'Alpha')],
    ])
    const list = [
      note('z', { bookId: 'b2' }),
      note('y', { bookId: 'gone' }),
      note('x', { bookId: 'b1' }),
    ]
    assert.deepEqual(sortNotes(list, 'book-title', booksById).map((n) => n.id), [
      'x',
      'z',
      'y',
    ])
  })

  it('returns a new array rather than sorting in place', () => {
    const list = [older, newer]
    const sorted = sortNotes(list, 'newest')
    assert.notEqual(sorted, list)
    assert.deepEqual(list.map((n) => n.id), ['a-old', 'b-new'])
  })
})

describe('counts and helpers', () => {
  const notes = [
    note('n1', { type: 'text' }),
    note('n2', { type: 'quote' }),
    note('n3', { type: 'quote' }),
  ]

  it('counts by type from real records only', () => {
    // A book claiming noteCount: 50 must not influence any count here.
    const books = [{ ...book('b1', 'Alpha'), noteCount: 50, quoteCount: 50 }]
    assert.deepEqual(countByType(notes), { all: 3, text: 1, quote: 2, image: 0 })
    assert.equal(books[0]?.noteCount, 50)
  })

  it('lists only books that actually own a note', () => {
    const books = [book('b1', 'Alpha'), book('b2', 'Beta')]
    const result = booksWithNotes(notes, books)
    assert.deepEqual(result.map((b) => b.id), ['b1'])
  })

  it('ignores book-level noteCount when choosing the book list', () => {
    const books = [
      { ...book('b1', 'HasNotes'), noteCount: 7 },
      { ...book('b2', 'ClaimsNotes'), noteCount: 99 },
    ]
    assert.deepEqual(booksWithNotes(notes, books).map((b) => b.id), ['b1'])
  })
})