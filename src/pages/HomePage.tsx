import { BookCard } from '@/components/books/BookCard'
import { PRIMARY_BUTTON } from '@/components/common/buttonStyles'
import { GlobalSearch } from '@/components/common/GlobalSearch'
import { SectionHeading } from '@/components/common/SectionHeading'
import { cn } from '@/lib/cn'
import { formatJalaliDate, formatWeekday } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import type { Book } from '@/types/book'

export interface HomePageProps {
  /** Every book in the library, already filtered by the shared search value. */
  books: Book[]
  searchValue: string
  onSearchChange: (value: string) => void
  /** Opens the add-book dialog, so the empty state can offer the next step. */
  onAddBook: () => void
}

/** How many books the "recent access" shelf shows. */
const RECENT_LIMIT = 6

/**
 * Dashboard home page.
 *
 * Reads from the live library so a book added, edited or deleted elsewhere in
 * the app shows up here immediately. There is no sample library and no fabricated
 * reading-activity panel any more: with nothing added yet, every section below
 * states that plainly rather than showing invented figures.
 */
export function HomePage({ books, searchValue, onSearchChange, onAddBook }: HomePageProps) {
  const currentlyReading = books.filter((book) => book.status === 'reading')

  // Most recently touched first; a book never opened sorts last.
  const recentBooks = [...books]
    .sort((a, b) => (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? ''))
    .slice(0, RECENT_LIMIT)

  return (
    <div className="space-y-12">
      <PageHeader
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        currentlyReadingCount={currentlyReading.length}
        recentCount={recentBooks.length}
      />

      {/* An empty library gets one clear next step instead of four empty
          sections stacked down the page. */}
      {books.length === 0 ? (
        <EmptyShelf onAddBook={onAddBook} />
      ) : (
        <>
          {/* Currently reading — the focal point of the dashboard. */}
          <section aria-labelledby="currently-reading" className="space-y-5">
            <SectionHeading
              eyebrow="در جریان"
              title="در حال خواندن"
              description="کتاب‌هایی که همین حالا بازشان کرده‌اید."
            />
            {currentlyReading.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {currentlyReading.map((book) => (
                  <BookCard key={book.id} book={book} variant="featured" />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-surface px-5 py-6 text-[0.9rem] leading-[2] text-ink-soft">
                در حال حاضر کتابی را در جریان ندارید. با تغییر وضعیت یک کتاب به «در حال
                خواندن»، اینجا نمایش داده می‌شود.
              </p>
            )}
          </section>

          {/* Recently accessed shelf. */}
          <section aria-labelledby="recently-accessed" className="space-y-5">
            <SectionHeading
              eyebrow="دوباره برگردید"
              title="دسترسی اخیر"
              description="آخرین کتاب‌هایی که به آن‌ها سر زدید."
            />
            {recentBooks.length ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
                {recentBooks.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-surface px-5 py-6 text-[0.9rem] leading-[2] text-ink-soft">
                هنوز کتابی باز نشده است.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** First-run state: nothing added yet, with the one action that fills the shelf. */
function EmptyShelf({ onAddBook }: { onAddBook: () => void }) {
  return (
    <section
      aria-labelledby="empty-shelf"
      className="rounded-xl border border-dashed border-line bg-surface/40 px-8 py-14 text-center"
    >
      <h2 id="empty-shelf" className="text-base font-semibold text-ink">
        قفسهٔ شما هنوز خالی است
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[0.9rem] leading-[2] text-ink-soft">
        کتابی که می‌خوانید را اضافه کنید تا اینجا ادامهٔ خواندن، یادداشت‌ها و
        نقل‌قول‌هایتان شکل بگیرد. هر چه اضافه می‌کنید فقط روی همین دستگاه ذخیره
        می‌شود.
      </p>
      <button
        type="button"
        onClick={onAddBook}
        data-testid="home-add-first-book"
        className={cn('mt-6', PRIMARY_BUTTON)}
      >
        افزودن نخستین کتاب
      </button>
    </section>
  )
}

interface PageHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  currentlyReadingCount: number
  recentCount: number
}

function PageHeader({
  searchValue,
  onSearchChange,
  currentlyReadingCount,
  recentCount,
}: PageHeaderProps) {
  return (
    <header className="max-w-3xl">
      <p className="text-[0.72rem] tracking-[0.16em] text-ink-faint uppercase">
        {formatWeekday()} {formatJalaliDate()}
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">
        خوش آمدید
      </h1>
      <p className="mt-4 text-[0.95rem] leading-[2] text-ink-soft">
        اینجا دفتر مطالعهٔ شماست؛ جایی برای نگه‌داشتن کتاب‌ها، نوشتن یادداشت و
        نگه‌داشتن جمله‌هایی که دوست دارید. آرام بنشینید و از خواندن لذت ببرید —
        بدون شلوغی و بدون عجله.
      </p>

      <GlobalSearch
        value={searchValue}
        onChange={onSearchChange}
        size="xl"
        hint="Enter"
        className="mt-7"
      />

      <p className="tabular mt-4 text-sm text-ink-faint">
        {formatNumber(currentlyReadingCount)} کتاب در جریان ·{' '}
        {formatNumber(recentCount)} کتاب در دسترس اخیر
      </p>
    </header>
  )
}
