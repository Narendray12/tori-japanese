import type { DayCount } from './stats'

/** The validated ordinal ramp, lightest to darkest. */
const RAMP = [
  'var(--color-ramp-1)',
  'var(--color-ramp-2)',
  'var(--color-ramp-3)',
  'var(--color-ramp-4)',
]
const EMPTY = 'var(--color-ramp-0)'

/** Buckets a count onto the ramp. Thresholds are review counts per day. */
export function rampStep(count: number): string {
  if (count <= 0) return EMPTY
  if (count < 5) return RAMP[0]
  if (count < 15) return RAMP[1]
  if (count < 40) return RAMP[2]
  return RAMP[3]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fullDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Reviews per day as a calendar grid, weeks running left to right. Each cell
 * carries its own title so hovering names the day and the count.
 */
export function Heatmap({ days }: { days: DayCount[] }) {
  if (!days.length) return null
  // Pad the front so the first column starts on the right weekday.
  const lead = days[0].date.getDay()
  const cells: (DayCount | null)[] = [...Array(lead).fill(null), ...days]
  const weeks: (DayCount | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <div className="flex gap-1" style={{ minWidth: 'min-content' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {Array.from({ length: 7 }, (_, di) => {
                const cell = week[di]
                if (!cell)
                  return <div key={di} className="size-3 rounded-[2px]" />
                return (
                  <div
                    key={di}
                    className="size-3 rounded-[2px]"
                    style={{ background: rampStep(cell.count) }}
                    title={`${fullDate(cell.date)}: ${cell.count} ${
                      cell.count === 1 ? 'review' : 'reviews'
                    }`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-faint">
        <span>Less</span>
        <span className="size-2.5 rounded-[2px]" style={{ background: EMPTY }} />
        {RAMP.map((c) => (
          <span key={c} className="size-2.5 rounded-[2px]" style={{ background: c }} />
        ))}
        <span>More</span>
        <span className="ml-auto">{WEEKDAYS[0]} at top</span>
      </figcaption>
    </figure>
  )
}

/**
 * Upcoming reviews per day. One series, so no legend: the heading names it.
 * Bars carry their value on hover and the peak is labeled directly.
 */
export function ForecastChart({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-soft">
        Nothing is scheduled yet. Reviews will appear here once you start learning.
      </p>
    )
  }

  // Explicit pixel heights: a percentage height inside an auto-height flex
  // column collapses to nothing, which is how these bars once rendered flat.
  const PLOT_PX = 96

  return (
    <figure className="m-0">
      <div className="flex items-end gap-1" style={{ height: PLOT_PX + 16 }}>
        {days.map((d) => {
          const isPeak = d.count === max && d.count > 0
          const px = d.count > 0 ? Math.max(3, Math.round((d.count / max) * PLOT_PX)) : 0
          return (
            <div
              key={d.key}
              className="flex flex-1 flex-col items-center justify-end gap-1"
            >
              <span
                className={`font-mono text-[10px] leading-none tabular-nums ${
                  isPeak ? 'text-ink-soft' : 'text-transparent'
                }`}
              >
                {d.count}
              </span>
              <div
                className="w-full rounded-t-[4px]"
                style={{ height: px, background: rampStep(d.count) }}
                title={`${fullDate(d.date)}: ${d.count} due`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1 border-t border-mist pt-1">
        {days.map((d, i) => (
          <span
            key={d.key}
            className="flex-1 text-center font-mono text-[9px] text-ink-faint"
          >
            {i === 0 ? 'today' : i % 2 === 0 ? d.date.getDate() : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

/**
 * How well the collection is known, as one ordered bar. The order carries the
 * meaning, so it uses the same one-hue ramp rather than unrelated colors.
 */
export function MaturityBar({
  parts,
}: {
  parts: { label: string; count: number; color: string }[]
}) {
  const total = parts.reduce((s, p) => s + p.count, 0)
  if (!total) return null
  return (
    <figure className="m-0">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {parts
          .filter((p) => p.count > 0)
          .map((p) => (
            <div
              key={p.label}
              style={{ width: `${(p.count / total) * 100}%`, background: p.color }}
              title={`${p.label}: ${p.count}`}
            />
          ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: p.color }}
              aria-hidden
            />
            <span className="text-ink-soft">{p.label}</span>
            <span className="font-mono tabular-nums">{p.count}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
