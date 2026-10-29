import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Spinner = ({ className }: { className?: string }) => {
  return <Loader2 aria-label="Cargando" className={cn('h-6 w-6 animate-spin text-primary', className)} />
}

export const FullPageSpinner = ({ label }: { label?: string }) => {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}
