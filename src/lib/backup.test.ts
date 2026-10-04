/**
 * Focused checks on the backup format: serialization, validation, and the
 * merge/replace planning that runs before anything is written to storage.
 *
 * Runs on Node's built-in runner with native type stripping, so no dependency
 * is added. The emphasis is on the rules that are easy to get subtly wrong:
 * portable image references, hostile input, and never overwriting user data.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BACKUP_FORMAT_VERSION,
  backupFilename,
  buildBackup,
  parseBackup,
  planImport,
  validateBackup,
} from './backup.ts'
import type { BackupFile } from './backup.ts'
import type { Book } from '../types/book.ts'
import type { Note } from '../types/note.ts'

/** 1x1 transparent PNG — the smallest valid image payload. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: 'b1',
    title: 'شب',
    author: 'یک نویسنده',
    status: 'reading',
    shelf: 'personal',
    progress: 0.4,
    totalPages: 220,
    currentPage: 88,
    origin: 'user',
    lastAccessedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  }
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    bookId: 'b1',
    type: 'text',
    content: 'یک یادداشت',
    page: 42,
    createdAt: '2026-03-02T09:00:00.000Z',
    ...overrides,
  }
}

function file(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: { name: 'Reading Journal', version: '1' },
    exportedAt: '2026-03-15T12:00:00.000Z',
    books: [book()],
    overrides: {},
    notes: [note()],
    assets: [],
    ...overrides,
  }
}

describe('buildBackup', () => {
  it('stamps the current format version and app identity', () => {
    const result = buildBackup({
      books: [book()],
      overrides: {},
      notes: [note()],
      assets: new Map(),
      app: { name: 'Reading Journal', version: '0.1.0' },
      exportedAt: '2026-03-15T12:00:00.000Z',
    })

    assert.equal(result.formatVersion, BACKUP_FORMAT_VERSION)
    assert.deepEqual(result.app, { name: 'Reading Journal', version: '0.1.0' })
  })

  it('rewrites idb references to portable backup keys', () => {
    const result = buildBackup({
      books: [book({ coverImage: 'idb:cover-1' })],
      overrides: { demo1: { coverImage: 'idb:cover-2' } },
      notes: [note({ type: 'image', imageRef: 'idb:shot-1' })],
      assets: new Map([
        ['idb:cover-1', { key: 'img-a', dataUrl: PNG, mimeType: 'image/png' }],
        ['idb:cover-2', { key: 'img-b', dataUrl: PNG, mimeType: 'image/png' }],
        ['idb:shot-1', { key: 'img-c', dataUrl: PNG, mimeType: 'image/png' }],
      ]),
      app: { name: 'x', version: '1' },
      exportedAt: '2026-03-15T12:00:00.000Z',
    })

    assert.equal(result.books[0].coverImage, 'img-a')
    assert.equal(result.overrides.demo1?.coverImage, 'img-b')
    assert.equal(result.notes[0].imageRef, 'img-c')
    assert.equal(result.assets.length, 3)
  })

  it('drops a reference it could not export rather than leaving it dangling', () => {
    const result = buildBackup({
      books: [book({ coverImage: 'idb:missing' })],
      overrides: {},
      notes: [note({ type: 'image', imageRef: 'blob:http://localhost/abc' })],
      assets: new Map(),
      app: { name: 'x', version: '1' },
      exportedAt: '2026-03-15T12:00:00.000Z',
    })

    // A blob: URL must never survive into a portable file.
    assert.equal(result.books[0].coverImage, undefined)
    assert.equal(result.notes[0].imageRef, undefined)
  })

  it('does not mutate the caller records', () => {
    const original = book({ coverImage: 'idb:cover-1' })
    buildBackup({
      books: [original],
      overrides: {},
      notes: [],
      assets: new Map([
        ['idb:cover-1', { key: 'img-a', dataUrl: PNG, mimeType: 'image/png' }],
      ]),
      app: { name: 'x', version: '1' },
      exportedAt: '2026-03-15T12:00:00.000Z',
    })

    assert.equal(original.coverImage, 'idb:cover-1')
  })
})

describe('backupFilename', () => {
  it('includes the app name and export date', () => {
    assert.equal(
      backupFilename('Reading Journal', '2026-03-15T12:00:00.000Z'),
      'Reading-Journal-backup-2026-03-15.json',
    )
  })

  it('falls back to a safe name when the date is malformed', () => {
    assert.equal(
      backupFilename('Reading Journal', 'not-a-date'),
      'Reading-Journal-backup-export.json',
    )
  })
})

describe('timestamp validation', () => {
  it('drops a book whose access time cannot be parsed', () => {
    const result = validateBackup(
      file({ books: [book({ lastAccessedAt: 'garbage' })] }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    // Unparseable input falls back to the epoch rather than propagating a value
    // that would sort arbitrarily against every real record.
    assert.equal(result.backup.books[0].lastAccessedAt, '1970-01-01T00:00:00.000Z')
  })

  it('drops optional book dates that are not real instants', () => {
    const result = validateBackup(
      file({ books: [book({ startedAt: 'yesterday-ish', finishedAt: 'soon' })] }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.books[0].startedAt, undefined)
    assert.equal(result.backup.books[0].finishedAt, undefined)
  })

  it('drops a note with an unparseable creation time', () => {
    const result = validateBackup(file({ notes: [note({ createdAt: 'nonsense' })] }))

    assert.equal(result.ok, true)
    if (!result.ok) return
    // The note is counted as skipped rather than restored unorderable.
    assert.equal(result.backup.notes.length, 0)
    assert.ok(result.warnings.some((w) => w.includes('یادداشت')))
  })

  it('rejects timestamps outside a plausible range', () => {
    const farFuture = validateBackup(
      file({ books: [book({ lastAccessedAt: '2999-01-01T00:00:00.000Z' })] }),
    )
    assert.equal(farFuture.ok, true)
    if (!farFuture.ok) return
    assert.equal(farFuture.backup.books[0].lastAccessedAt, '1970-01-01T00:00:00.000Z')

    const farPast = validateBackup(
      file({ notes: [note({ createdAt: '1900-01-01T00:00:00.000Z' })] }),
    )
    assert.equal(farPast.ok, true)
    if (!farPast.ok) return
    assert.equal(farPast.backup.notes.length, 0)
  })

  it('normalises a valid timestamp to a canonical ISO form', () => {
    const result = validateBackup(
      file({
        notes: [note({ createdAt: '2026-03-02T09:00:00+03:30' })],
      }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    // Re-serialised so every stored timestamp compares the same way regardless
    // of the offset the exporting device happened to write.
    assert.equal(result.backup.notes[0].createdAt, '2026-03-02T05:30:00.000Z')
  })

  it('ignores an unparseable export timestamp rather than keeping it', () => {
    const result = validateBackup(file({ exportedAt: 'whenever' }))

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.exportedAt, '1970-01-01T00:00:00.000Z')
  })
})

describe('validateBackup', () => {
  it('rejects text that is not JSON', () => {
    const result = parseBackup('{ definitely not json')
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'unreadable')
  })

  it('rejects a JSON array or primitive', () => {
    assert.deepEqual(validateBackup([]), { ok: false, reason: 'not-an-object' })
    assert.deepEqual(validateBackup('hello'), { ok: false, reason: 'not-an-object' })
  })

  it('rejects a file with no format version', () => {
    const result = validateBackup({ books: [book()], notes: [] })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'missing-format')
  })

  it('rejects a future format version instead of guessing', () => {
    const result = validateBackup(file({ formatVersion: 99 }))
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'unsupported-version')
      assert.equal(result.detail, '99')
    }
  })

  it('rejects an empty library rather than allowing a destructive replace', () => {
    const result = validateBackup(file({ books: [], notes: [], overrides: {} }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'no-records')
  })

  it('drops malformed records and reports them as warnings', () => {
    // Deliberately malformed: these are the shapes a hostile or truncated file
    // can contain, so they are typed `unknown` to bypass the model.
    const badBooks: unknown[] = [
      { id: 'b2' },
      { title: 'بدون شناسه' },
      null,
      'nope',
    ]
    const badNotes: unknown[] = [
      { id: 'n2' },
      { id: 'n3', bookId: 'b1' },
    ]

    const result = validateBackup({
      ...file(),
      books: [book(), ...badBooks],
      notes: [note(), ...badNotes],
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    // The one good book survives; the four broken ones are skipped.
    assert.equal(result.backup.books.length, 1)
    // A note without createdAt cannot be ordered, so it is dropped.
    assert.equal(result.backup.notes.length, 1)
    // Two warnings expected: the skipped books and the skipped notes. Compared
    // by count so the assertion does not depend on the terminal's encoding.
    assert.equal(result.warnings.length, 2)
  })

  it('coerces unknown status and note type to safe defaults', () => {
    const result = validateBackup(
      file({
        books: [book({ status: 'exploded' as never })],
        notes: [note({ type: 'video' as never })],
      }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.books[0].status, 'want-to-read')
    assert.equal(result.backup.notes[0].type, 'text')
  })

  it('rejects out-of-range progress and page values', () => {
    const result = validateBackup(
      file({
        books: [book({ progress: 5, currentPage: -3 })],
        notes: [note({ page: 0 })],
      }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.books[0].progress, 0)
    assert.equal(result.backup.books[0].currentPage, undefined)
    assert.equal(result.backup.notes[0].page, undefined)
  })

  it('ignores a cover reference that names no asset in the file', () => {
    const result = validateBackup(file({ books: [book({ coverImage: 'img-ghost' })] }))

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.books[0].coverImage, undefined)
  })

  it('demotes an image note whose asset is missing to a text note', () => {
    const result = validateBackup(
      file({ notes: [note({ type: 'image', imageRef: 'img-gone' })] }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.notes[0].type, 'text')
  })

  it('discards a data URL with a non-image mime type', () => {
    const result = validateBackup(
      file({
        books: [],
        notes: [note()],
        assets: [
          {
            key: 'bad',
            dataUrl: 'data:text/html;base64,PHNjcmlwdD4=',
            mimeType: 'text/html',
          },
        ],
      }),
    )

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.assets.length, 0)
    assert.ok(result.warnings.length > 0)
  })

  it('survives prototype pollution through nested keys', () => {
    const hostile = JSON.parse(
      '{"formatVersion":1,"books":[],"notes":[],"overrides":' +
        '{"__proto__":{"status":"abandoned"},"ok1":{"status":"finished"}}}',
    )

    const result = validateBackup(hostile)
    assert.equal(result.ok, true)
    if (!result.ok) return
    // The polluted key is dropped entirely rather than assigned.
    assert.deepEqual(Object.keys(result.backup.overrides), ['ok1'])
    assert.equal(({} as Record<string, unknown>).status, undefined)
  })

  it('round-trips a backup built by buildBackup', () => {
    const built = buildBackup({
      books: [book({ coverImage: 'idb:c1' })],
      overrides: { demo1: { progress: 0.9 } },
      notes: [note({ type: 'image', imageRef: 'idb:c1' })],
      assets: new Map([
        ['idb:c1', { key: 'img-a', dataUrl: PNG, mimeType: 'image/png' }],
      ]),
      app: { name: 'Reading Journal', version: '0.1.0' },
      exportedAt: '2026-03-15T12:00:00.000Z',
    })

    const result = parseBackup(JSON.stringify(built))
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.backup.books.length, 1)
    assert.equal(result.backup.notes.length, 1)
    assert.equal(result.backup.assets.length, 1)
    // The portable reference is preserved, and origin is forced to 'user'.
    assert.equal(result.backup.books[0].coverImage, 'img-a')
    assert.equal(result.backup.books[0].origin, 'user')
  })
})

describe('planImport — replace', () => {
  it('discards existing user records', () => {
    const plan = planImport({
      backup: file({
        books: [book({ id: 'b2', title: 'جدید' })],
        notes: [note({ id: 'n2', bookId: 'b2' })],
      }),
      currentBooks: [book()],
      currentOverrides: {},
      currentNotes: [note()],
      demoBookIds: new Set(['demo1']),
      strategy: 'replace',
    })

    assert.equal(plan.books.length, 1)
    assert.equal(plan.books[0].id, 'b2')
    assert.equal(plan.notes.length, 1)
    assert.equal(plan.notes[0].bookId, 'b2')
  })

  it('re-keys assets so nothing points at a stale local key', () => {
    const plan = planImport({
      backup: file({
        books: [book({ coverImage: 'img-a' })],
        assets: [{ key: 'img-a', dataUrl: PNG, mimeType: 'image/png' }],
      }),
      currentBooks: [],
      currentOverrides: {},
      currentNotes: [],
      demoBookIds: new Set(),
      strategy: 'replace',
    })

    const cover = plan.books[0].coverImage
    assert.ok(cover?.startsWith('idb:'))
    // The new key differs from the backup key it came from.
    assert.notEqual(cover, 'img-a')
    assert.equal(plan.assetKeyMap.get('img-a'), cover?.slice(4))
  })

  it('clears overrides that are not in the backup', () => {
    const plan = planImport({
      backup: file({ books: [book({ id: 'b2' })], notes: [], overrides: {} }),
      currentBooks: [],
      currentOverrides: { demo1: { progress: 0.9 } },
      currentNotes: [],
      demoBookIds: new Set(['demo1']),
      strategy: 'replace',
    })

    assert.deepEqual(Object.keys(plan.overrides), [])
  })
})

describe('planImport — merge', () => {
  const demo = new Set(['demo1'])

  it('adds new records and preserves existing ones', () => {
    const plan = planImport({
      backup: file({
        books: [book({ id: 'b-new', title: 'کتاب تازه' })],
        // `file()` already contains a note on b1; keep it so the backup is a
        // realistic mix, and add one that belongs to the new book.
        notes: [note(), note({ id: 'n-new', bookId: 'b-new' })],
      }),
      currentBooks: [book()],
      currentOverrides: {},
      // The local note shares id n1 with the backup's first note, proving the
      // local copy wins on a merge.
      currentNotes: [note()],
      demoBookIds: demo,
      strategy: 'merge',
    })

    assert.deepEqual(
      plan.books.map((b) => b.id),
      ['b1', 'b-new'],
    )
    // n1 is a duplicate and is re-keyed, so only its count is stable.
    assert.equal(plan.notes.length, 2)
    assert.equal(plan.preview.books, 1)
    assert.equal(plan.preview.notes, 1)
    assert.deepEqual(plan.preview.duplicateNoteIds, ['n1'])
  })

  it('never overwrites an existing book and re-keys the duplicate', () => {
    const plan = planImport({
      backup: file({
        books: [book({ id: 'b1', title: 'نسخه فایل' })],
        // The same id as the local note, so the conflict path is exercised.
        notes: [note({ id: 'n1', bookId: 'b1', content: 'از فایل' })],
      }),
      currentBooks: [book({ title: 'نسخه محلی' })],
      currentOverrides: {},
      currentNotes: [note({ content: 'نسخه محلی' })],
      demoBookIds: demo,
      strategy: 'merge',
    })

    // The local record wins untouched.
    assert.equal(plan.books.find((b) => b.id === 'b1')?.title, 'نسخه محلی')
    // The imported copy is kept alongside it under a new id.
    assert.equal(plan.books.length, 2)
    assert.equal(plan.books[1].title, 'نسخه فایل')
    assert.notEqual(plan.books[1].id, 'b1')
    // Both the note and the book collided, and both were re-keyed rather than
    // overwriting what the user already had.
    assert.deepEqual(plan.preview.duplicateNoteIds, ['n1'])
    assert.deepEqual(plan.preview.duplicateBookIds, ['b1'])
    assert.equal(plan.notes.length, 2)
    // The local note keeps its id; only the imported one is re-keyed.
    assert.equal(plan.notes.filter((n) => n.id === 'n1').length, 1)
    assert.equal(plan.notes.find((n) => n.id === 'n1')?.content, 'نسخه محلی')
  })

  it('rewrites note references when a duplicate book is re-keyed', () => {
    const plan = planImport({
      backup: file({
        books: [book({ id: 'b1' })],
        notes: [note({ id: 'n-brand-new', bookId: 'b1' })],
      }),
      currentBooks: [book({ id: 'b1' })],
      currentOverrides: {},
      currentNotes: [],
      demoBookIds: demo,
      strategy: 'merge',
    })

    const added = plan.books.find((b) => b.id !== 'b1')
    assert.ok(added)
    // The note follows its book to the new id, so it never dangles.
    assert.equal(plan.notes[0].bookId, added?.id)
  })

  it('restores notes belonging to a bundled demo book', () => {
    const plan = planImport({
      backup: file({ books: [], notes: [note({ bookId: 'demo1' })] }),
      currentBooks: [],
      currentOverrides: {},
      currentNotes: [],
      demoBookIds: demo,
      strategy: 'merge',
    })

    assert.equal(plan.notes.length, 1)
    assert.equal(plan.preview.notesForBundledBooks, 1)
  })

  it('drops a note whose parent book exists nowhere', () => {
    const plan = planImport({
      backup: file({ books: [], notes: [note({ bookId: 'ghost-book' })] }),
      currentBooks: [],
      currentOverrides: {},
      currentNotes: [],
      demoBookIds: demo,
      strategy: 'merge',
    })

    assert.equal(plan.notes.length, 0)
  })

  it('keeps a local override rather than clobbering it', () => {
    const plan = planImport({
      backup: file({ books: [], notes: [], overrides: { demo1: { progress: 0.1 } } }),
      currentBooks: [],
      currentOverrides: { demo1: { progress: 0.8 } },
      currentNotes: [],
      demoBookIds: demo,
      strategy: 'merge',
    })

    assert.equal(plan.overrides.demo1?.progress, 0.8)
  })

  it('adds an override that does not exist locally', () => {
    const plan = planImport({
      backup: file({ books: [], notes: [], overrides: { demo2: { progress: 0.3 } } }),
      currentBooks: [],
      currentOverrides: {},
      currentNotes: [],
      demoBookIds: demo,
      strategy: 'merge',
    })

    assert.equal(plan.overrides.demo2?.progress, 0.3)
  })

  it('leaves the caller state untouched', () => {
    const books = [book()]
    const notes = [note()]
    planImport({
      backup: file({
        books: [book({ id: 'b2' })],
        notes: [note({ id: 'n2', bookId: 'b2' })],
      }),
      currentBooks: books,
      currentOverrides: {},
      currentNotes: notes,
      demoBookIds: demo,
      strategy: 'merge',
    })

    assert.equal(books.length, 1)
    assert.equal(notes.length, 1)
  })
})
