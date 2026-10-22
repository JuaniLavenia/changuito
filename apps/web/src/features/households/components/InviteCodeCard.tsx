import { useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Código de invitación</h2>
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
    </Card>
  )
}
