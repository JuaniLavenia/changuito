import { useId, useState } from 'react'
import { Check, ChevronDown, Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface InviteCodeCardProps {
  householdName: string
  inviteCode: string
  canRegenerate: boolean
  regenerating: boolean
  onRegenerate: () => void
}

export const InviteCodeCard = ({
  householdName,
  inviteCode,
  canRegenerate,
  regenerating,
  onRegenerate,
}: InviteCodeCardProps) => {
  const [open, setOpen] = useState(false)
  const contentId = useId()
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const text = `Únete a "${householdName}" en Changuito con el código ${inviteCode}: ${window.location.origin}`
    if (navigator.share) {
      await navigator.share({ title: 'Changuito', text }).catch(() => undefined)
      return
    }
    await navigator.clipboard?.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="space-y-3">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 text-sm font-medium text-muted-foreground"
        >
          Código de invitación
          <ChevronDown aria-hidden className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </h2>
      {open && (
        <div id={contentId} className="space-y-3">
          <div>
            <p className="font-mono text-3xl font-semibold tracking-widest text-primary">{inviteCode}</p>
            <p className="text-sm text-muted-foreground">Compártelo para que tu familia se una a este hogar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={share}>
              {copied ? <Check aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Compartir código'}
            </Button>
            {canRegenerate && (
              <Button variant="ghost" onClick={onRegenerate} disabled={regenerating}>
                <RefreshCw aria-hidden className="h-4 w-4" />
                Generar código nuevo
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
