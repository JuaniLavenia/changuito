import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Spinner = ({ className }: { className?: string }) => {
  return <Loader2 aria-label="Cargando" className={cn('h-6 w-6 animate-spin text-primary', className)} />
}

export const FullPageSpinner = () => {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
