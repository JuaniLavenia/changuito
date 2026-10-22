import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Field = ({ id, label, children }: { id: string; label: string; children: ReactNode }) => {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}

export const Select = ({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  )
}
