import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm', className)}
      {...props}
    />
  )
}
