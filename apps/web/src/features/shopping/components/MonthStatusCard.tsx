import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ShoppingCart } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { formatPrice, formatProductCount } from '@/lib/format'

export type MonthStatus =
  | { kind: 'loading' }
  | { kind: 'no-list'; pendingFromLastMonth: number }
  | { kind: 'ready'; itemCount: number }
  | { kind: 'shopping'; itemCount: number; inCart: number; spent: number }

const linkClass =
  'inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground'

export const MonthStatusCard = ({ status }: { status: MonthStatus }) => {
  const headingId = useId()

  return (
    <Card role="region" aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-sm font-medium text-muted-foreground">
        Este mes
      </h2>
      <MonthStatusBody status={status} />
    </Card>
  )
}

const MonthStatusBody = ({ status }: { status: MonthStatus }) => {
  switch (status.kind) {
    case 'loading':
      return <Spinner />
    case 'no-list':
      return (
        <>
          <p>Todavía no revisaron el stock este mes.</p>
          {status.pendingFromLastMonth > 0 && (
            <p className="text-sm text-muted-foreground">
              {formatProductCount(status.pendingFromLastMonth)}{' '}
              {status.pendingFromLastMonth === 1 ? 'quedó pendiente' : 'quedaron pendientes'} del mes pasado. Te los
              vamos a ofrecer al revisar el stock.
            </p>
          )}
          <Link to="/stock" className={linkClass}>
            <ClipboardList aria-hidden className="h-4 w-4" />
            Revisar stock
          </Link>
        </>
      )
    case 'ready':
      return (
        <>
          <p>La lista de este mes está lista: {formatProductCount(status.itemCount)}.</p>
          <Link to="/super" className={linkClass}>
            <ShoppingCart aria-hidden className="h-4 w-4" />
            Ir al súper
          </Link>
        </>
      )
    case 'shopping':
      return (
        <>
          <p className="font-medium">
            {status.inCart} de {status.itemCount} en el carrito
          </p>
          <p className="text-sm text-muted-foreground">Llevan gastado {formatPrice(status.spent)}</p>
          <Link to="/super" className={linkClass}>
            <ShoppingCart aria-hidden className="h-4 w-4" />
            Seguir comprando
          </Link>
        </>
      )
  }
}
