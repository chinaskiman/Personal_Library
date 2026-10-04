/**
 * Checks on the storage measurement behind the Settings page.
 *
 * The theme of these tests is honesty about gaps: Node has neither
 * `localStorage` nor `navigator.storage`, which is exactly the "browser refused
 * to tell us" case the page has to render without lying.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { measureStorage } from './storageInfo.ts'
import type { Book } from '../types/book.ts'
import type { Note } from '../types/note.ts'

function book(id: string, title: string): Book {
  return {
    id,
    title,
    author: 'یک نویسنده',
    status: 'want-to-read',
    shelf: 'personal',
    progress: 0,
    origin: 'user',
    lastAccessedAt: '2026-03-01T10:00:00.000Z',
  }
}

function note(id: string, bookId: string): Note {
  return {
    id,
    bookId,
    type: 'text',
    content: 'یک یادداشت',
    createdAt: '2026-03-02T09:00:00.000Z',
  }
}

describe('measureStorage', () => {
  it('reports records as unavailable where there is no local storage', async () => {
    const info = await measureStorage([book('b1', 'شب')], [note('n1', 'b1')])

    // Node has no localStorage, so `available` must be false rather than a
    // confident-looking number.
    assert.equal(info.available, false)
  })

  it('measures a non-zero record size for real records', async () => {
    const empty = await measureStorage([], [])
    const full = await measureStorage([book('b1', 'شب')], [note('n1', 'b1')])

    assert.ok(empty.recordsBytes >= 0)
    assert.ok(
      full.recordsBytes > empty.recordsBytes,
      'records should measure larger once data is present',
    )
  })

  it('leaves quota fields undefined when the browser does not expose them', async () => {
    const info = await measureStorage([], [])

    assert.equal(info.usageBytes, undefined)
    assert.equal(info.quotaBytes, undefined)
  })

  it('resolves rather than rejecting when every backend is missing', async () => {
    // A rejected promise here would surface in Settings as an unhandled error
    // and leave the storage section stuck on "measuring".
    await assert.doesNotReject(() => measureStorage([], []))
  })

  it('counts zero images when the image store is unreachable', async () => {
    const info = await measureStorage([], [])

    assert.equal(info.imageCount, 0)
  })
})