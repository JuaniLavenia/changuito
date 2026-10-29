import { tripSpend } from '@changuito/domain'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { MonthStatusCard, type MonthStatus } from './components/MonthStatusCard'
import { SpendingHistoryCard } from './components/SpendingHistoryCard'
import { useCarryOver, useClosedTrips, useListItems, useOpenList } from './queries'

/** Where the household stands this month, and what past trips cost. */
export const MonthSummary = ({ householdId }: { householdId: string }) => {
  const openList = useOpenList(householdId)
  const items = useListItems(openList.data?.id)
  const carryOver = useCarryOver(householdId)
  const closedTrips = useClosedTrips(householdId)

  if (openList.isError || items.isError || carryOver.isError || closedTrips.isError) {
    return <ErrorMessage>No pudimos cargar el resumen del mes. Revisa tu conexión y recarga la página.</ErrorMessage>
  }

  return (
    <div className="space-y-4">
      <MonthStatusCard status={toMonthStatus(openList.data, items.data, carryOver.data)} />
      {closedTrips.data && closedTrips.data.length > 0 && <SpendingHistoryCard trips={closedTrips.data} />}
    </div>
  )
}

function toMonthStatus(
  openList: ReturnType<typeof useOpenList>['data'],
  items: ReturnType<typeof useListItems>['data'],
  carryOver: ReturnType<typeof useCarryOver>['data'],
): MonthStatus {
  if (openList === undefined) return { kind: 'loading' }
  if (openList === null) {
    return carryOver ? { kind: 'no-list', pendingFromLastMonth: carryOver.length } : { kind: 'loading' }
  }
  if (!items) return { kind: 'loading' }

  const inCart = items.filter((item) => item.status === 'in_cart').length
  if (inCart === 0) return { kind: 'ready', itemCount: items.length }
  return { kind: 'shopping', itemCount: items.length, inCart, spent: tripSpend(items) }
}
