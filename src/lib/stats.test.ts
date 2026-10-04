/**
 * Focused checks on the insights calculations.
 *
 * These run on Node's built-in test runner with native type stripping, so the
 * project gains test coverage without adding a dependency. The suite is
 * deliberately about *honesty* rules — unknown data must never masquerade as a
 * zero, and invented numbers must never leak into a total.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildNoteActivity,
  buildRecentActivity,
  computeLibraryOverview,
  computeProgressInsight,
  parseTimestamp,
  startOfPersianWeek,
} from './stats.ts'
import type { Book } from '../types/book.ts'
import type { Note } from '../types/note.ts'

const NOW = new Date('2026-03-15T12:00:00.000Z')

function book(overrides: Partial<Book> & { id: string }): Book {
  return {
    title: 'Untitled',
    author: 'Anon',
    status: 'reading',
    shelf: 'personal',
    progress: 0,
    lastAccessedAt: '2026-03-01T00:00:00.000Z',
    origin: 'user',
    ...overrides,
  }
}

function note(overrides: Partial<Note> & { id: string }): Note {
  return {
    bookId: 'b1',
    type: 'text',
    content: 'entry',
    createdAt: '2026-03-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('parseTimestamp', () => {
  it('accepts a valid past timestamp', () => {
    assert.equal(
      parseTimestamp('2026-03-14T10:00:00Z', NOW)?.toISOString(),
      '2026-03-14T10:00:00.000Z',
    )
  })

  it('rejects malformed, empty, and future values', () => {
    assert.equal(parseTimestamp('not-a-date', NOW), null)
    assert.equal(parseTimestamp('', NOW), null)
    assert.equal(parseTimestamp(undefined, NOW), null)
    assert.equal(parseTimestamp(null, NOW), null)
    // A far-future date implies corrupt storage, not real activity.
    assert.equal(parseTimestamp('2099-01-01T00:00:00Z', NOW), null)
  })
})

describe('computeLibraryOverview', () => {
  it('counts notes from real records, ignoring decorative noteCount fields', () => {
    // `noteCount: 99` has no backing Note record and must not be summed.
    const stats = computeLibraryOverview(
      [book({ id: 'b1', noteCount: 99, quoteCount: 40 })],
      [note({ id: 'n1', type: 'text' }), note({ id: 'n2', type: 'quote' })],
    )

    assert.equal(stats.totalNotes, 2)
    assert.deepEqual(stats.notesByType, { text: 1, quote: 1, image: 0 })
describe('computeProgressInsight', () => {
  it('returns a null average when nothing has progress', () => {
    const insight = computeProgressInsight([book({ id: 'b1', progress: 0 })])
    // "Unknown" must never be reported as 0%.
    assert.equal(insight.averageProgress, null)
    assert.equal(insight.booksWithoutProgress, 1)
    assert.equal(insight.rows.length, 0)
  })

  it('averages only books that have real progress', () => {
    const insight = computeProgressInsight([
      book({ id: 'b1', progress: 0.5 }),
      book({ id: 'b2', progress: 0.3 }),
      book({ id: 'b3', progress: 0 }),
    ])

    assert.equal(insight.rows.length, 2)
    assert.equal(insight.booksWithoutProgress, 1)
    assert.ok(Math.abs((insight.averageProgress ?? 0) - 0.4) < 1e-9)
  })

  it('reports a page pair only when both numbers are sane', () => {
    const insight = computeProgressInsight([
      book({ id: 'ok', progress: 0.5, currentPage: 50, totalPages: 200 }),
      book({ id: 'noTotal', progress: 0.5, currentPage: 50 }),
      book({ id: 'past-end', progress: 0.5, currentPage: 500, totalPages: 200 }),
      book({ id: 'zeroTotal', progress: 0.5, currentPage: 5, totalPages: 0 }),
    ])

    const byId = new Map(insight.rows.map((row) => [row.book.id, row]))
    assert.equal(byId.get('ok')?.currentPage, 50)
    assert.equal(byId.get('ok')?.totalPages, 200)
    assert.equal(byId.get('noTotal')?.currentPage, null)
    assert.equal(byId.get('past-end')?.currentPage, null)
    assert.equal(byId.get('zeroTotal')?.totalPages, null)
    assert.equal(insight.booksWithPageData, 1)
  })

  it('ignores books that are not currently being read', () => {
    const insight = computeProgressInsight([
      book({ id: 'b1', status: 'finished', progress: 1 }),
      book({ id: 'b2', status: 'want-to-read', progress: 0.9 }),
    ])
    assert.equal(insight.rows.length, 0)
    assert.equal(insight.averageProgress, null)
  })

  it('does not mutate its input', () => {
    const input = book({ id: 'b1', progress: 0.42 })
    const snapshot = structuredClone(input)
    computeProgressInsight([input])
    assert.deepEqual(input, snapshot)
  })
describe('buildNoteActivity', () => {
  it('produces one bucket per week, oldest first, ending on the current week', () => {
    const buckets = buildNoteActivity([], NOW, 12)
    assert.equal(buckets.length, 12)
    assert.equal(buckets.at(-1)?.isCurrent, true)
    assert.ok(
      (buckets[0]?.weekStart ?? '') < (buckets.at(-1)?.weekStart ?? ''),
      'weeks must ascend',
    )
  })

  it('places each note in its own Persian week and drops out-of-range ones', () => {
    const buckets = buildNoteActivity(
      [
        note({ id: 'n1', createdAt: NOW.toISOString() }),
        note({ id: 'n2', createdAt: NOW.toISOString() }),
        note({ id: 'n3', createdAt: '2020-01-01T00:00:00.000Z' }),
      ],
      NOW,
      12,
    )

    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
    // Two fall inside the window; the 2020 note lies outside it entirely.
    assert.equal(total, 2)
    assert.equal(buckets.at(-1)?.count, 2)
  })

  it('starts Persian weeks on Saturday', () => {
    assert.equal(startOfPersianWeek(new Date('2026-03-12T09:00:00')).getDay(), 6)
  })
})

describe('buildRecentActivity', () => {
  it('sorts newest first', () => {
    const { events } = buildRecentActivity(
      [],
      [
        note({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
        note({ id: 'new', createdAt: '2026-03-12T00:00:00.000Z' }),
      ],
      NOW,
    )

    assert.equal(events[0]?.id, 'note-created:new')
    assert.equal(events[1]?.id, 'note-created:old')
  })

  it('shows a note once, as an edit when it was revised', () => {
    const { events } = buildRecentActivity(
      [],
      [
        note({
          id: 'n1',
          createdAt: '2026-03-10T00:00:00.000Z',
          updatedAt: '2026-03-11T00:00:00.000Z',
        }),
      ],
      NOW,
    )

    assert.equal(events.length, 1)
    assert.equal(events[0]?.kind, 'note-updated')
  })

  it('ignores an updatedAt that is not later than createdAt', () => {
    const { events } = buildRecentActivity(
      [],
      [
        note({
          id: 'n1',
          createdAt: '2026-03-10T00:00:00.000Z',
          updatedAt: '2026-03-09T00:00:00.000Z',
        }),
      ],
      NOW,
    )
    assert.equal(events[0]?.kind, 'note-created')
  })

  it('links a note to its book and tolerates a deleted one', () => {
    const { events } = buildRecentActivity(
      [book({ id: 'b1', title: 'Kept' })],
      [
        note({ id: 'n1', bookId: 'b1', createdAt: '2026-03-12T00:00:00.000Z' }),
        note({ id: 'n2', bookId: 'ghost', createdAt: '2026-03-12T00:00:00.000Z' }),
      ],
      NOW,
    )

    assert.equal(
      events.find((event) => event.id === 'note-created:n1')?.book?.title,
      'Kept',
    )
    assert.equal(
      events.find((event) => event.id === 'note-created:n2')?.book,
      null,
    )
  })

  it('drops unparseable timestamps and reports emptiness honestly', () => {
    const { events, isEmpty } = buildRecentActivity(
      [book({ id: 'b1', lastAccessedAt: 'garbage' })],
      [note({ id: 'n1', createdAt: 'garbage' })],
      NOW,
    )

    assert.deepEqual(events, [])
    assert.equal(isEmpty, true)
  })

  it('honours the limit', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      note({
        id: `n${index}`,
        createdAt: new Date(NOW.getTime() - index * 86_400_000).toISOString(),
      }),
    )
    assert.equal(buildRecentActivity([], many, NOW, 5).events.length, 5)
  })
})
})
  })

  it('counts by recorded origin, for records that still carry one', () => {
    // The sample library has been removed, but `origin` remains in the schema so
    // older stored records and backup files still parse.
    const stats = computeLibraryOverview(
      [
        book({ id: 'b1', origin: 'demo', status: 'finished' }),
        book({ id: 'b2', origin: 'user', status: 'reading' }),
      ],
      [note({ id: 'n1', bookId: 'b1' }), note({ id: 'n2', bookId: 'ghost' })],
    )

    assert.deepEqual(stats.byOrigin, { demo: 1, user: 1 })
    assert.equal(stats.byStatus.finished, 1)
    assert.equal(stats.booksWithNotes, 1)
    assert.equal(stats.orphanedNotes, 1)
  })

  it('defaults a missing origin to user', () => {
    // A book can only enter the library through the user now, so an absent
    // origin must not be read as a sample record.
    const stats = computeLibraryOverview([{ ...book({ id: 'b1' }), origin: undefined }], [])
    assert.equal(stats.byOrigin.user, 1)
    assert.equal(stats.byOrigin.demo, 0)
  })

  it('reports an empty library as all zeroes', () => {
    const stats = computeLibraryOverview([], [])
    assert.equal(stats.totalBooks, 0)
    assert.equal(stats.totalNotes, 0)
    assert.deepEqual(stats.byOrigin, { demo: 0, user: 0 })
    assert.equal(stats.orphanedNotes, 0)
  })
})