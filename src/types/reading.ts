/** A single day in the reading-activity strip. */
export interface ActivityDay {
  /** ISO date (YYYY-MM-DD). */
  date: string
  /** Single Persian weekday abbreviation, e.g. «ش». */
  label: string
  pagesRead: number
  minutesRead: number
}

/** Headline numbers shown in the compact reading summary. */
export interface ReadingSummary {
  /** Books currently in progress. */
  currentlyReading: number
  /** Books finished in total. */
  finished: number
  /** Books queued to read. */
  wantToRead: number
  /** Consecutive days with at least one reading session. */
  dayStreak: number
  /** Pages read in the trailing seven days. */
  pagesThisWeek: number
  /** Average daily reading time over the trailing seven days, in minutes. */
  dailyAverageMinutes: number
}
