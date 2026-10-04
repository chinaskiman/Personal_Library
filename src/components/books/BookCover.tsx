import { useMemo, useState } from 'react'

import { useStoredImage } from '@/hooks/useStoredImage'
import { cn } from '@/lib/cn'

/** Deterministic decorative variants, so a given book always looks the same. */
const COVER_THEMES = [
  { base: '#E4D9C6', band: '#826D55', ink: '#4A3F33' },
  { base: '#D9D2C0', band: '#5E7359', ink: '#3E463A' },
  { base: '#E6DCD0', band: '#96604F', ink: '#4E3B33' },
  { base: '#DCD6CB', band: '#8B7C66', ink: '#443B31' },
  { base: '#E3DACE', band: '#6A5742', ink: '#413830' },
  { base: '#DAD8CB', band: '#5C6B6B', ink: '#37403F' },
] as const

/**
 * Typography and inset scale for each cover size.
 * The small cover is only ~150px wide, so it needs a proportionally smaller
 * label than the featured cover or the type turns to mush.
 */
const COVER_SCALE = {
  sm: {
    padding: '8%',
    titleClass: 'text-[0.55rem] leading-[1.25]',
    motifHeight: '40%',
  },
  lg: {
    padding: '11%',
    titleClass: 'text-[0.7rem] leading-[1.3]',
    motifHeight: '46%',
  },
} as const

export interface BookCoverProps {
  /** Stable key used to pick the placeholder artwork. */
  seed: string
  /** Original English title, rendered LTR on the placeholder. */
  title: string
  /**
   * Optional cover: an `idb:<key>` reference from the image store, a bundled
   * asset path, or a remote URL. Falls back to the CSS placeholder on error.
   */
  src?: string
  /** `alt` text for the cover image. */
  alt: string
  className?: string
  /** `cover-sm` = grid card, `cover-lg` = featured card. */
  size?: 'sm' | 'lg'
}

/** Simple, stable string hash used to vary placeholder artwork. */
function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Book cover.
 *
 * Renders a locally-bundled image when one exists and gracefully degrades to
 * an elegant, deterministic CSS-drawn placeholder otherwise — so the UI never
 * shows a broken image icon or depends on a remote URL.
 */
export function BookCover({
  seed,
  title,
  src,
  alt,
  className,
  size = 'sm',
}: BookCoverProps) {
  const [hasFailed, setHasFailed] = useState(false)

  // Stored references (`idb:<key>`) resolve to an object URL here, so every
  // caller can pass the persisted value straight through without unwrapping it.
  const { url: resolved } = useStoredImage(src)
  const showImage = Boolean(src) && !hasFailed
  // While a stored blob is still loading, render the placeholder rather than
  // flashing an empty frame.
  const imageSrc = resolved

  const { theme, motif } = useMemo(() => {
    const value = hashSeed(seed)
    return {
      theme: COVER_THEMES[value % COVER_THEMES.length] ?? COVER_THEMES[0],
      motif: (value >> 3) % 4,
    }
  }, [seed])

  const scale = COVER_SCALE[size]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md border border-line-soft bg-surface-sunken shadow-cover',
        'transition-transform duration-500 ease-editorial',
        className,
      )}
    >
      {showImage && imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          loading="lazy"
          onError={() => setHasFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-full flex-col justify-between"
          style={{ backgroundColor: theme.base, padding: scale.padding }}
        >
          {/* Decorative motif — a simple, letterpress-like arrangement. */}
          <div className="flex items-start justify-between">
            <div
              className="h-px w-[38%]"
              style={{ backgroundColor: theme.band, opacity: 0.7 }}
            />
            <div
              className="size-1.5 rounded-full"
              style={{ backgroundColor: theme.band, opacity: 0.55 }}
            />
          </div>

          <div
            className="flex flex-1 items-center justify-center py-[6%]"
            style={{ minHeight: scale.motifHeight }}
          >
            {motif === 0 ? (
              <div
                className="h-[42%] w-[52%] rounded-[2px] border"
                style={{ borderColor: theme.band, opacity: 0.5 }}
              />
            ) : motif === 1 ? (
              <div
                className="h-[46%] w-[46%] rotate-45 border"
                style={{ borderColor: theme.band, opacity: 0.45 }}
              />
            ) : motif === 2 ? (
              <div className="flex h-[48%] items-end gap-[6px]">
                {[0.45, 0.9, 0.62, 0.78].map((factor, index) => (
                  <div
                    key={index}
                    className="w-[4px] rounded-full"
                    style={{
                      height: `${factor * 100}%`,
                      backgroundColor: theme.band,
                      opacity: 0.4,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div
                className="h-[40%] w-[56%] border-t border-b"
                style={{ borderColor: theme.band, opacity: 0.45 }}
              />
            )}
          </div>

          {/* Spine hint along the inline-start edge. */}
          <div
            className="absolute inset-y-0 start-0 w-[6px]"
            style={{
              background: `linear-gradient(to right, ${theme.band}33, transparent)`,
            }}
          />

          <div
            className={`ltr line-clamp-2 font-medium tracking-wide uppercase opacity-70 ${scale.titleClass}`}
            style={{ color: theme.ink }}
          >
            {title}
          </div>
        </div>
      )}
    </div>
  )
}
