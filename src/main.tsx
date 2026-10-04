import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { purgeAllImages } from '@/lib/imageStore'
import { runLibraryResetOnce } from '@/lib/libraryReset'
import { STORAGE_KEYS, SCHEMA_VERSION } from '@/lib/persistence'
import '@/styles/index.css'

/**
 * One-time cleanup of the old demonstration library.
 *
 * Runs before React mounts so the first render already sees an empty library and
 * there is no frame in which the sample books appear and then vanish.
 *
 * Everything here — including dropping the images those records pointed at — is
 * owned by `runLibraryResetOnce`, which performs it only on the single launch
 * that actually clears the library. Calling the image purge from here instead
 * would delete every cover and note image on *every* page load, which is exactly
 * the regression this arrangement exists to prevent.
 */
async function resetLibraryOnceOnBoot(): Promise<void> {
  const storage = (() => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage
    } catch {
      // Storage access itself can throw in locked-down privacy modes.
      return null
    }
  })()

  if (!storage) return

  await runLibraryResetOnce(
    {
      storage,
      booksKey: STORAGE_KEYS.books,
      notesKey: STORAGE_KEYS.notes,
      versionKey: STORAGE_KEYS.version,
      schemaVersion: SCHEMA_VERSION,
    },
    purgeAllImages,
  )
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root was not found in index.html')
}

void resetLibraryOnceOnBoot().finally(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
