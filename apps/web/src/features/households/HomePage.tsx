import { MonthSummary } from '@/features/shopping/MonthSummary'
import type { Household } from './household-repository'
import { InviteCodeCard } from './components/InviteCodeCard'
import { useRegenerateInviteCode } from './queries'

export const HomePage = ({ household }: { household: Household }) => {
  const regenerate = useRegenerateInviteCode()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-primary">{household.name}</h1>
      <MonthSummary householdId={household.id} />
      <InviteCodeCard
        householdName={household.name}
        inviteCode={household.inviteCode}
        canRegenerate={household.role === 'admin'}
        regenerating={regenerate.isPending}
        onRegenerate={() => regenerate.mutate(household.id)}
      />
    </div>
  )
}
