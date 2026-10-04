import { useEffect, useState } from 'react'

import { getImageBlob, isImageRef } from '@/lib/imageStore'

export interface StoredImage {
  /** Object URL valid for this render. Revoked automatically on change/unmount. */
  url: string | undefined
  /** True while the blob is being read from IndexedDB. */
  loading: boolean
  /** True when a reference existed but could not be read. */
  missing: boolean
}

/**
 * Resolve a persisted `idb:` image reference into a usable object URL.
 *
 * Object URLs are scoped to the document, so they are minted here and revoked
 * whenever the reference changes or the component unmounts. A reference that
 * cannot be read resolves to `missing`, letting callers fall back to a
 * placeholder instead of rendering a broken image.
 *
 * Non-`idb:` values (a bundled asset path, or plain `undefined`) pass straight
 * through, so callers do not need to branch on the reference format.
 */
export function useStoredImage(ref?: string): StoredImage {
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(Boolean(ref && isImageRef(ref)))
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    // Not a stored reference — nothing to resolve.
    if (!ref || !isImageRef(ref)) {
      setUrl(undefined)
      setLoading(false)
      setMissing(false)
      return
    }

    let active = true
    let objectUrl: string | undefined

    setLoading(true)
    setMissing(false)

    void getImageBlob(ref).then((blob) => {
      // Ignore a resolution that arrives after the reference changed.
      if (!active) return

      if (blob) {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } else {
        setUrl(undefined)
        setMissing(true)
      }
      setLoading(false)
    })

    return () => {
      active = false
      // Revoke here so the blob URL never outlives the render that used it.
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [ref])

  // A non-stored reference is returned verbatim so bundled assets still work.
  const isStored = ref ? isImageRef(ref) : false
  return { url: isStored ? url : ref, loading, missing }
}