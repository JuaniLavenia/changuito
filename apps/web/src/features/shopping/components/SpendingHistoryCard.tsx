import { useId } from 'react'
import { spendingChange } from '@changuito/domain'
import { Card } from '@/components/ui/Card'
import { formatMonth, formatPrice } from '@/lib/format'
import type { ClosedTripSummary } from '../shopping-repository'

const describeChange = (change: number) => {
  const percent = Math.round(Math.abs(change) * 100)
  if (percent === 0) return 'Lo mismo que la compra anterior'
  return `${percent}% ${change > 0 ? 'más' : 'menos'} que la compra anterior`
}

/** Closed trips, most recent first. */
export const SpendingHistoryCard = ({ trips }: { trips: ClosedTripSummary[] }) => {
  const headingId = useId()
  const [last, previous] = trips
  const change = previous ? spendingChange(last.total, previous.total) : null

  return (
    <Card role="region" aria-labelledby={headingId} className="space-y-3">
      <div>
        <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
          Historial de gasto
        </h2>
        {change !== null && <p className="text-sm">{describeChange(change)}</p>}
      </div>
      <ul className="divide-y divide-border">
        {trips.map((trip) => (
          <li key={trip.id} className="flex items-baseline justify-between gap-2 py-2">
            <span className="first-letter:uppercase">{formatMonth(trip.period)}</span>
            <span className="font-medium tabular-nums">{formatPrice(trip.total)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
