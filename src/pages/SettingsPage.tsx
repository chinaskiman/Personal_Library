import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Download,
  HardDrive,
  Moon,
  Palette,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'

import { PRIMARY_BUTTON } from '@/components/common/buttonStyles'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SectionHeading } from '@/components/common/SectionHeading'
import { APP_CONFIG } from '@/config/app'
import {
  THEME_OPTIONS,
  type ThemePreference,
} from '@/hooks/useThemePreference'
import {
  BACKUP_MIME,
  type BackupFile,
  type ImportPlan,
  type ImportStrategy,
} from '@/lib/backup'
import {
  CLEAR_SUCCESS,
  EXPORT_MESSAGES,
  IMPORT_MESSAGES,
  importSuccessMessage,
} from '@/lib/backupMessages'
import {
  exportBackup,
  prepareImport,
  readBackupFile,
  writeImportAssets,
} from '@/lib/backupService'
import { formatBytes, formatNumber } from '@/lib/format'
import { isImageRef, pruneUnreferencedImages } from '@/lib/imageStore'
import { measureStorage, type StorageEstimate } from '@/lib/storageInfo'
import { cn } from '@/lib/cn'
import type { Book } from '@/types/book'
import type { Note } from '@/types/note'

/**
 * ---------------------------------------------------------------------------
 *  SETTINGS
 * ---------------------------------------------------------------------------
 * Four concerns, kept as separate blocks rather than one form: appearance,
 * backup, storage, and a destructive reset.
 *
 * The rule running through all of them is that nothing irreversible happens
 * quietly. Export reports what it wrote *and* what it had to leave out. Import
 * writes nothing until the user has seen the file's contents and chosen between
 * merging and replacing. Clearing asks first and states what survives. Every
 * failure is explained in a sentence rather than a code — and a failed import is
 * described as a no-op, because if it failed the old library is still there.
 * ---------------------------------------------------------------------------
 */

/** Status of one backup action. */
type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'done'; message: string }
  | { kind: 'failed'; message: string }

/** A file that passed validation and is waiting for the user's decision. */
interface PendingImport {
  backup: BackupFile
  warnings: string[]
  fileName: string
}

/** What an action reports back, so results are shaped identically everywhere. */
type ActionResult = { ok: true; message: string } | { ok: false; message: string }

export interface SettingsPageProps {
  /**
   * The current appearance preference.
   *
   * Supplied rather than read here: the hook lives in `App` so it stays mounted
   * for the whole session, and the document keeps following the OS in `system`
   * mode no matter which page the user is on.
   */
  themePreference: ThemePreference
  onThemeChange: (value: ThemePreference) => void
  /** The user's own books. Sample books are never exported. */
  userBooks: Book[]
  /** User edits layered onto sample books, keyed by demo book id. */
  overrides: Record<string, Partial<Book>>
  notes: Note[]
  /** Commit a whole record set, as produced by an import plan. */
  onImport: (records: {
    books: Book[]
    overrides: Record<string, Partial<Book>>
    notes: Note[]
  }) => void
  /** Remove all user data, keeping the bundled sample library. */
  onClear: () => void
  /** False once a write has failed, so the page can warn about it. */
  persisted: boolean
}

/**
 * Book ids that ship with the application.
 *
 * The bundled sample library has been removed, so this is empty. The parameter is
 * still part of the import plan: it lets the planner recognise a note that
 * belongs to an app-provided book rather than dropping it as orphaned, which keeps
 * old backup files readable if one ever names such a book.
 */
const DEMO_BOOK_IDS: ReadonlySet<string> = new Set<string>()

const THEME_ICON: Record<ThemePreference, ReactNode> = {
  light: <Sun className="size-4" aria-hidden="true" />,
  dark: <Moon className="size-4" aria-hidden="true" />,
  system: <HardDrive className="size-4" aria-hidden="true" />,
}

/**
 * Every image reference a committed record set still depends on.
 *
 * Used to decide what may safely be deleted after a replace: a reference the
 * surviving records keep is off limits, anything else is an orphan.
 */
function collectImageRefs(plan: ImportPlan): string[] {
  const refs: string[] = []

  for (const book of plan.books) {
    if (isImageRef(book.coverImage)) refs.push(book.coverImage)
  }
  for (const patch of Object.values(plan.overrides)) {
    if (isImageRef(patch.coverImage)) refs.push(patch.coverImage)
  }
  for (const note of plan.notes) {
    if (isImageRef(note.imageRef)) refs.push(note.imageRef)
  }

  return refs
}

export function SettingsPage({
  themePreference,
  onThemeChange,
  userBooks,
  overrides,
  notes,
  onImport,
  onClear,
  persisted,
}: SettingsPageProps) {
  const [exportStatus, setExportStatus] = useState<BackupStatus>({ kind: 'idle' })
  const [importStatus, setImportStatus] = useState<BackupStatus>({ kind: 'idle' })
  const [clearStatus, setClearStatus] = useState<BackupStatus>({ kind: 'idle' })
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [strategy, setStrategy] = useState<ImportStrategy>('merge')
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [storage, setStorage] = useState<StorageEstimate | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-measured whenever the data it describes changes, so the figures cannot
  // drift out of date behind the user's back.
  const refreshStorage = useCallback(() => {
    void measureStorage(userBooks, notes).then(setStorage)
  }, [userBooks, notes])

  useEffect(refreshStorage, [refreshStorage])

  const overrideCount = Object.keys(overrides).length
  const hasOwnData = userBooks.length > 0 || notes.length > 0 || overrideCount > 0
  const busy = exportStatus.kind === 'busy' || importStatus.kind === 'busy'

  /**
   * Run one async action while showing its progress.
   *
   * Every action reports through this helper so its result is shaped the same
   * way: the component never inspects an internal error code to decide whether
   * to write a success or a failure sentence.
   */
  const runAction = useCallback(
    async (
      label: string,
      setStatus: (status: BackupStatus) => void,
      action: () => Promise<ActionResult>,
    ): Promise<ActionResult> => {
      setStatus({ kind: 'busy', label })

      let result: ActionResult
      try {
        result = await action()
      } catch {
        // Nothing in these services is expected to throw, but an unexpected
        // error must still leave an explanation rather than a stuck button.
        result = { ok: false, message: 'این کار انجام نشد و هیچ چیز تغییر نکرد.' }
      }

      setStatus(
        result.ok
          ? { kind: 'done', message: result.message }
          : { kind: 'failed', message: result.message },
      )
      return result
    },
    [],
  )

  /** Build a backup file and hand it to the user as a download. */
  const handleExport = useCallback(async () => {
    await runAction('در حال ساخت فایل پشتیبان…', setExportStatus, async () => {
      const result = await exportBackup({
        books: userBooks,
        overrides,
        notes,
        app: { name: APP_CONFIG.name, version: APP_CONFIG.version },
      })

      if (!result.ok) return { ok: false, message: EXPORT_MESSAGES[result.reason] }

      // `size` is the file's real byte length, not a guess about it.
      const parts = [
        `فایل پشتیبان ساخته شد (${formatBytes(result.size)}) و دانلود آن آغاز شد.`,
      ]
      if (result.assetsIncluded > 0) {
        parts.push(`${formatNumber(result.assetsIncluded)} تصویر در آن بود.`)
      }
      // An image left behind is a silent loss unless it is stated outright.
      if (result.assetsSkipped > 0) {
        parts.push(
          `${formatNumber(result.assetsSkipped)} تصویر در حافظه نبود و در پشتیبان نیامد.`,
        )
      }
      if (result.recordsMissingImage > 0) {
        parts.push(
          `${formatNumber(result.recordsMissingImage)} مورد به همین دلیل بدون تصویر ذخیره شد.`,
        )
      }

      return { ok: true, message: parts.join(' ') }
    })
  }, [runAction, userBooks, overrides, notes])

  /**
   * Validate a chosen file and show what it holds.
   *
   * Nothing is written here: the user gets a preview and an explicit choice, so
   * a mis-click cannot destroy a library.
   */
  const handleFile = useCallback(
    async (file: File | undefined) => {
      setPending(null)
      if (!file) return

      const result = await runAction('در حال بررسی فایل…', setImportStatus, async () => {
        const parsed = await readBackupFile(file)
        if (!parsed.ok) return { ok: false, message: IMPORT_MESSAGES[parsed.reason] }

        setPending({
          backup: parsed.backup,
          warnings: parsed.warnings,
          fileName: file.name,
        })
        return { ok: true, message: 'فایل معتبر است. روش بازگردانی را انتخاب کنید.' }
      })

      // A valid file leaves the panel asking a question, so the status line is
      // cleared rather than also reporting it as a completed action.
      if (result.ok) setImportStatus({ kind: 'idle' })

      // Selecting the same file again must fire `change`, so clear the input.
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [runAction],
  )

  /**
   * Commit the pending import.
   *
   * Assets are written first and metadata committed only once that succeeded, so
   * a failure here leaves the previous library completely untouched.
   */
  const handleApplyImport = useCallback(async () => {
    if (!pending) return

    const result = await runAction('در حال بازگردانی…', setImportStatus, async () => {
      const plan = prepareImport({
        backup: pending.backup,
        strategy,
        currentBooks: userBooks,
        currentOverrides: overrides,
        currentNotes: notes,
        demoBookIds: DEMO_BOOK_IDS,
      })

      const assets = await writeImportAssets(plan, pending.backup)
      if (!assets.ok) {
        return {
          ok: false,
          message:
            'تصویرهای این پشتیبان ذخیره نشد، پس بازگردانی انجام نشد و کتابخانهٔ شما دست‌نخورده باقی ماند.',
        }
      }

      onImport({ books: plan.books, overrides: plan.overrides, notes: plan.notes })
      setConfirmImport(false)
      setPending(null)

      // Only now that the new records are committed can the images they replaced
      // be removed. Pruning before the commit would delete assets the surviving
      // records still point at. `replace` is the only strategy that orphans
      // anything: a merge keeps every local record and therefore every reference.
      if (strategy === 'replace') {
        void pruneUnreferencedImages(collectImageRefs(plan)).then(refreshStorage)
      } else {
        refreshStorage()
      }

      return {
        ok: true,
        message: importSuccessMessage(
          plan.preview.books,
          plan.preview.notes,
          assets.written,
          [...pending.warnings, ...describeMergeOutcome(plan, strategy)],
        ),
      }
    })

    // A failed restore changed nothing, so there is nothing left to confirm.
    if (!result.ok) setConfirmImport(false)
  }, [pending, strategy, userBooks, overrides, notes, onImport, runAction, refreshStorage])

  /** Clear the user's data, after an explicit confirmation. */
  const handleClear = useCallback(async () => {
    const result = await runAction('در حال پاک کردن…', setClearStatus, async () => {
      onClear()

      // Everything the user owned is gone, so every stored image is now an
      // orphan. Bundled sample books ship their own assets and are not in this
      // store, so nothing still on screen can be affected.
      await pruneUnreferencedImages([])
      refreshStorage()
      return { ok: true, message: CLEAR_SUCCESS }
    })

    if (result.ok) setConfirmClear(false)
  }, [onClear, runAction, refreshStorage])

  return (
    <div className="space-y-10">
      <SectionHeading
        level={1}
        eyebrow="تنظیمات"
        title="تنظیمات برنامه"
        description="ظاهر برنامه، پشتیبان‌گیری از کتابخانه و بازگردانی اطلاعات. همهٔ این کارها فقط روی همین دستگاه انجام می‌شود."
      />

      {!persisted ? <PersistenceNotice /> : null}

      {/* --------------------------------------------------------- APPEARANCE */}
      <section className="space-y-5" aria-labelledby="settings-appearance">
        <div className="flex items-center gap-2.5">
          <Palette className="size-4 text-accent" aria-hidden="true" />
          <h2 id="settings-appearance" className="text-base font-semibold text-ink">
            ظاهر برنامه
          </h2>
        </div>

        <div
          role="radiogroup"
          aria-label="ظاهر برنامه"
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => {
            const active = themePreference === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`theme-${option.value}`}
                onClick={() => onThemeChange(option.value)}
                className={[
                  'flex items-start gap-3 rounded-lg border p-4 text-start transition-colors duration-200',
                  active
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-canvas hover:border-line-strong',
                ].join(' ')}
              >
                <span className="mt-0.5 shrink-0 text-ink-soft">
                  {THEME_ICON[option.value]}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {option.label}
                    {active ? (
                      <Check className="size-3.5 text-accent" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[0.78rem] leading-relaxed text-ink-faint">
                    {option.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ BACKUP */}
      <section className="space-y-5" aria-labelledby="settings-backup">
        <div className="flex items-center gap-2.5">
          <Download className="size-4 text-accent" aria-hidden="true" />
          <h2 id="settings-backup" className="text-base font-semibold text-ink">
            پشتیبان‌گیری
          </h2>
        </div>

        <div className="rounded-xl border border-line bg-canvas p-5">
          <h3 className="text-sm font-medium text-ink">ساخت فایل پشتیبان</h3>
          <p className="mt-2 text-[0.85rem] leading-[1.9] text-ink-soft">
            یک فایل متنی ساده از کتاب‌ها، یادداشت‌ها و تصویرهای شماست. آن را هرجا
            نگه دارید و روی هر دستگاهی بازگردانید. کتاب‌های نمونه در آن نیستند، چون
            همراه خودِ برنامه نصب می‌شوند.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={busy}
              data-testid="export-backup"
              className={PRIMARY_BUTTON}
            >
              <Download className="size-3.5" aria-hidden="true" />
              ساخت پشتیبان
            </button>
            {!hasOwnData ? (
              <span className="text-[0.78rem] text-ink-faint">
                هنوز داده‌ای از خودتان ثبت نکرده‌اید.
              </span>
            ) : null}
          </div>

          <StatusLine status={exportStatus} />
        </div>

        <div className="rounded-xl border border-line bg-canvas p-5">
          <h3 className="text-sm font-medium text-ink">بازگردانی از پشتیبان</h3>
          <p className="mt-2 text-[0.85rem] leading-[1.9] text-ink-soft">
            فایل پشتیبانی که ساخته‌اید را انتخاب کنید تا محتوای آن را ببینید. تا
            زمانی که خودتان تأیید نکنید، چیزی در کتابخانه تغییر نمی‌کند.
          </p>

          <div className="mt-4">
            <label className="sr-only" htmlFor="backup-file">
              انتخاب فایل پشتیبان
            </label>
            <input
              ref={fileInputRef}
              id="backup-file"
              type="file"
              accept={`${BACKUP_MIME},application/json,.json`}
              onChange={(event) => void handleFile(event.target.files?.[0])}
              disabled={busy}
              data-testid="import-file"
              className="block w-full max-w-md text-[0.8rem] text-ink-soft file:me-3 file:h-9 file:rounded-md file:border file:border-line file:bg-surface file:px-4 file:text-[0.8rem] file:text-ink file:transition-colors hover:file:border-line-strong"
            />
          </div>

          <StatusLine status={importStatus} />

          {pending ? (
            <ImportChoice
              pending={pending}
              strategy={strategy}
              onStrategyChange={setStrategy}
              onConfirm={() => setConfirmImport(true)}
            />
          ) : null}
        </div>
      </section>

      <StorageInfo
        info={storage}
        bookCount={userBooks.length}
        noteCount={notes.length}
      />

      {/* ------------------------------------------------------------- CLEAR */}
      <section className="space-y-5" aria-labelledby="settings-clear">
        <div className="flex items-center gap-2.5">
          <Trash2 className="size-4 text-status-dropped" aria-hidden="true" />
          <h2 id="settings-clear" className="text-base font-semibold text-ink">
            پاک کردن اطلاعات
          </h2>
        </div>

        <div className="rounded-xl border border-status-dropped/40 bg-canvas p-5">
          <h3 className="text-sm font-medium text-ink">پاک کردن کتاب‌ها و یادداشت‌های من</h3>
          <p className="mt-2 text-[0.85rem] leading-[1.9] text-ink-soft">
            همهٔ کتاب‌هایی که خودتان اضافه کرده‌اید، یادداشت‌هایتان و تصویرهایشان
            برای همیشه پاک می‌شوند. این کار برگشت‌پذیر نیست، پس اگر پشتیبان نگرفته‌اید
            ابتدا از دکمهٔ بالا فایل پشتیبان بسازید. کتاب‌های نمونه باقی می‌مانند.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={busy || !hasOwnData}
              data-testid="clear-library"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-status-dropped bg-status-dropped px-4 text-[0.8rem] font-medium text-canvas transition-colors duration-200 hover:bg-status-dropped/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              پاک کردن اطلاعات من
            </button>
            {hasOwnData ? (
              <span className="text-[0.78rem] text-ink-faint">
                {formatNumber(userBooks.length)} کتاب و {formatNumber(notes.length)} یادداشت
              </span>
            ) : null}
          </div>

          <StatusLine status={clearStatus} />
        </div>
      </section>

      {/* ----------------------------------------------------------- DIALOGS */}
      <ConfirmDialog
        open={confirmImport}
        title={strategy === 'replace' ? 'جایگزینی کتابخانه' : 'افزودن به کتابخانه'}
        description={
          strategy === 'replace'
            ? 'همهٔ کتاب‌ها و یادداشت‌های فعلی شما با محتوای این فایل جایگزین می‌شوند و آنچه در فایل نیست از بین می‌رود. کتاب‌های نمونه باقی می‌مانند. این کار برگشت‌پذیر نیست.'
            : 'کتاب‌ها و یادداشت‌های این فایل به کتابخانهٔ فعلی شما اضافه می‌شوند و چیزی از داده‌های فعلی پاک نمی‌شود.'
        }
        confirmLabel={strategy === 'replace' ? 'بله، جایگزین کن' : 'بله، اضافه کن'}
        destructive={strategy === 'replace'}
        onConfirm={() => void handleApplyImport()}
        onCancel={() => setConfirmImport(false)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="پاک کردن اطلاعات"
        description="همهٔ کتاب‌های شما، یادداشت‌ها و تصویرهایشان برای همیشه پاک می‌شوند و بازگرداندنشان ممکن نیست. کتاب‌های نمونه باقی می‌مانند."
        confirmLabel="بله، همه را پاک کن"
        destructive
        onConfirm={() => void handleClear()}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- *
 *  Sub-components
 * -------------------------------------------------------------------------- */

/** One line reporting what an action is doing, or what became of it. */
function StatusLine({ status }: { status: BackupStatus }) {
  if (status.kind === 'idle') return null

  return (
    <p
      // Announced so a screen reader hears the outcome without the user having
      // to go looking for it.
      role="status"
      aria-live="polite"
      data-testid="backup-status"
      className={[
        'mt-4 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[0.8rem] leading-relaxed',
        status.kind === 'failed'
          ? 'border-status-dropped/40 bg-status-dropped/10 text-ink'
          : 'border-line bg-surface text-ink-soft',
      ].join(' ')}
    >
      {status.kind === 'done' ? (
        <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
      ) : null}
      {status.kind === 'failed' ? (
        <AlertTriangle
          className="mt-0.5 size-3.5 shrink-0 text-status-dropped"
          aria-hidden="true"
        />
      ) : null}
      <span>{status.kind === 'busy' ? status.label : status.message}</span>
    </p>
  )
}

/** Warns that changes are not being saved, which also limits what backup can do. */
function PersistenceNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-status-dropped/40 bg-status-dropped/10 px-4 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-dropped" aria-hidden="true" />
      <p className="text-[0.82rem] leading-relaxed text-ink-soft">
        ذخیرهٔ خودکار در این مرورگر کار نمی‌کند، پس تغییرات شما با بستن صفحه از بین
        می‌رود. تا وقتی این مشکل برطرف نشده، پشتیبان‌گیری هم چیزی برای ذخیره پیدا
        نمی‌کند.
      </p>
    </div>
  )
}

interface ImportChoiceProps {
  pending: PendingImport
  strategy: ImportStrategy
  onStrategyChange: (strategy: ImportStrategy) => void
  onConfirm: () => void
}

/**
 * What the chosen file contains, and the choice of how to apply it.
 *
 * The counts are the file's *own* contents, not the result of applying it, so the
 * user is looking at what they selected before deciding what to do with it. The
 * consequence of each strategy is spelled out in full.
 */
function ImportChoice({
  pending,
  strategy,
  onStrategyChange,
  onConfirm,
}: ImportChoiceProps) {
  const { books, notes, assets } = pending.backup

  return (
    <div
      data-testid="import-preview"
      className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-4"
    >
      <h4 className="text-sm font-medium text-ink">این فایل چه دارد؟</h4>
      <p className="mt-1 text-[0.78rem] text-ink-faint">{pending.fileName}</p>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Figure value={books.length} label="کتاب" />
        <Figure value={notes.length} label="یادداشت" />
        <Figure value={assets.length} label="تصویر" />
      </dl>

      {pending.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[0.75rem] leading-relaxed text-ink-soft">
          {pending.warnings.map((warning) => (
            <li key={warning} className="flex gap-1.5">
              <span aria-hidden="true">•</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="mt-4 space-y-2">
        <legend className="text-[0.8rem] font-medium text-ink">روش بازگردانی</legend>

        <StrategyOption
          id="strategy-merge"
          checked={strategy === 'merge'}
          onChange={() => onStrategyChange('merge')}
          label="افزودن به کتابخانهٔ فعلی"
          hint="اطلاعات فعلی شما می‌ماند و موارد این فایل به آن اضافه می‌شود. اگر کتابی در هر دو باشد، نسخهٔ شما دست‌نخورده می‌ماند و نسخهٔ فایل با شناسه‌ای تازه کنارش قرار می‌گیرد."
        />
        <StrategyOption
          id="strategy-replace"
          checked={strategy === 'replace'}
          onChange={() => onStrategyChange('replace')}
          label="جایگزینی کل کتابخانه"
          hint="همهٔ کتاب‌ها و یادداشت‌های فعلی شما پاک می‌شوند و فقط محتوای این فایل می‌ماند. کتاب‌های نمونه باقی می‌مانند."
        />
      </fieldset>

      <button
        type="button"
        onClick={onConfirm}
        data-testid="confirm-import"
        className={cn('mt-4', PRIMARY_BUTTON)}
      >
        <Upload className="size-3.5" aria-hidden="true" />
        بازگردانی
      </button>
    </div>
  )
}

/** A count in the preview grid. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-2 py-2.5">
      <dt className="text-[0.72rem] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-ink">{formatNumber(value)}</dd>
    </div>
  )
}

interface StrategyOptionProps {
  id: string
  checked: boolean
  onChange: () => void
  label: string
  hint: string
}

/** One merge/replace choice, with its consequence stated rather than implied. */
function StrategyOption({
  id,
  checked,
  onChange,
  label,
  hint,
}: StrategyOptionProps) {
  return (
    <label
      htmlFor={id}
      className={[
        'flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors duration-200',
        checked
          ? 'border-accent bg-canvas'
          : 'border-line bg-canvas hover:border-line-strong',
      ].join(' ')}
    >
      <input
        id={id}
        type="radio"
        name="import-strategy"
        checked={checked}
        onChange={onChange}
        data-testid={id}
        className="mt-1 size-3.5 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className="block text-[0.82rem] font-medium text-ink">{label}</span>
        <span className="mt-1 block text-[0.75rem] leading-relaxed text-ink-faint">
          {hint}
        </span>
      </span>
    </label>
  )
}

interface StorageInfoProps {
  info: StorageEstimate | null
  bookCount: number
  noteCount: number
}

/**
 * Live counts and a storage estimate.
 *
 * Anything the browser refuses to report is omitted rather than guessed at, and a
 * missing quota is stated as "the browser did not say" — a silent gap here would
 * read as "there is plenty of room".
 */
function StorageInfo({ info, bookCount, noteCount }: StorageInfoProps) {
  return (
    <section className="space-y-5" aria-labelledby="settings-storage">
      <div className="flex items-center gap-2.5">
        <HardDrive className="size-4 text-accent" aria-hidden="true" />
        <h2 id="settings-storage" className="text-base font-semibold text-ink">
          فضای ذخیره‌سازی
        </h2>
      </div>

      <div className="rounded-xl border border-line bg-canvas p-5">
        <h3 className="text-sm font-medium text-ink">اطلاعات شما روی این دستگاه</h3>

        {!info ? (
          <p className="mt-3 text-[0.82rem] text-ink-faint">در حال اندازه‌گیری…</p>
        ) : (
          <>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="کتاب‌های شما" value={formatNumber(bookCount)} />
              <Stat label="یادداشت‌ها" value={formatNumber(noteCount)} />
              <Stat label="تصویرها" value={formatNumber(info.imageCount)} />
            </dl>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[0.8rem]">
              <Row label="حجم تقریبی متن‌ها" value={formatBytes(info.recordsBytes)} />
              {info.usageBytes !== undefined ? (
                <Row label="کل فضای مصرف‌شدهٔ مرورگر" value={formatBytes(info.usageBytes)} />
              ) : null}
              {info.quotaBytes !== undefined ? (
                <Row label="فضای در دسترس مرورگر" value={formatBytes(info.quotaBytes)} />
              ) : null}
            </dl>

            {!info.available ? (
              <Note>
                ذخیرهٔ خودکار در این مرورگر فعال نیست، بنابراین تغییرات شما پس از
                بستن صفحه باقی نمی‌ماند.
              </Note>
            ) : null}
            {info.imageStoreUnavailable ? (
              <Note>
                مرورگر اجازهٔ شمردن تصویرها را نداد، بنابراین تعداد آنها دقیق نیست.
              </Note>
            ) : null}
            {info.quotaBytes === undefined ? (
              <Note>
                این مرورگر میزان فضای در دسترس را اعلام نمی‌کند، پس نمی‌توان گفت
                چقدر جا باقی است.
              </Note>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

/** A labelled figure in the storage grid. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5">
      <dt className="text-[0.72rem] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-ink">{value}</dd>
    </div>
  )
}

/** A label/value line. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}

/** A caveat about what could not be measured. */
function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-faint">{children}</p>
}

/**
 * Explain what a completed import actually did.
 *
 * The plan already counts conflicts, but a bare number ("۲ تکراری") does not tell
 * the user *which* copy survived — so the outcome is stated in words too.
 */
function describeMergeOutcome(plan: ImportPlan, strategy: ImportStrategy): string[] {
  const messages: string[] = []
  const { duplicateBookIds, duplicateNoteIds, notesForBundledBooks } = plan.preview

  if (strategy === 'merge' && duplicateBookIds.length > 0) {
    messages.push(
      `${formatNumber(duplicateBookIds.length)} کتاب در هر دو کتابخانه بود؛ نسخهٔ فعلی شما نگه داشته شد و نسخهٔ فایل با شناسه‌ای تازه کنارش اضافه شد.`,
    )
  }

  if (strategy === 'merge' && duplicateNoteIds.length > 0) {
    messages.push(
      `${formatNumber(duplicateNoteIds.length)} یادداشت تکراری بود و هر دو نسخه نگه داشته شد.`,
    )
  }

  if (notesForBundledBooks > 0) {
    messages.push(
      `${formatNumber(notesForBundledBooks)} یادداشت برای کتاب‌های نمونه بازگردانده شد، برای همین تعداد کتاب‌های شما بیشتر نشد.`,
    )
  }

  if (strategy === 'replace') {
    messages.push('کتاب‌های نمونه دست‌نخورده باقی ماندند.')
  }

  return messages
}