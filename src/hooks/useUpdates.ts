import { useMemo } from 'react'
import { formatDate } from '@/domain/dates'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { services } from '@/lib/container'
import { markSeen, useSeen } from '@/lib/seen'

export type UpdateItem = {
  id: string
  tone: 'success' | 'danger' | 'info'
  title: string
  body: string
  href: string
  linkLabel: string
}

/**
 * Things that happened without the person being there, shown once until dismissed:
 * - students: a seat request was approved or declined
 * - owners: a plan payment was verified or marked failed
 * Derived from existing records, so it needs no extra table.
 */
export function useUpdates() {
  const { user } = useAuth()
  const seen = useSeen(user?.id)
  const role = user?.role

  const student = useAsync(
    () => (role === 'student' ? services.listMySeatRequests() : Promise.resolve([])),
    [role, user?.id],
  )
  const owner = useAsync(async () => {
    if (role !== 'owner') return []
    const lib = await services.getMyLibrary()
    return lib ? services.listMyPlanPayments(lib.id) : []
  }, [role, user?.id])

  const updates = useMemo<UpdateItem[]>(() => {
    const out: UpdateItem[] = []
    for (const r of student.data ?? []) {
      if (r.status === 'approved') {
        out.push({
          id: `req-${r.id}`,
          tone: 'success',
          title: `You got a seat at ${r.libraryName}`,
          body: `Your ${r.shiftName} request was approved. Your seat number is in My membership.`,
          href: '/student/membership',
          linkLabel: 'See my seat',
        })
      } else if (r.status === 'rejected') {
        out.push({
          id: `req-${r.id}`,
          tone: 'danger',
          title: `${r.libraryName} couldn't give you a seat`,
          body: `Your ${r.shiftName} request was declined. Try another shift or library.`,
          href: '/discover',
          linkLabel: 'Find another library',
        })
      }
    }
    for (const p of owner.data ?? []) {
      if (p.status === 'verified' && p.verifiedAt) {
        out.push({
          id: `pay-${p.id}`,
          tone: 'success',
          title: 'Your payment was verified',
          body: `Thanks. Your plan is active. Payment of UTR ${p.utr} was confirmed on ${formatDate(p.verifiedAt.slice(0, 10))}.`,
          href: '/owner/plan',
          linkLabel: 'View plan',
        })
      } else if (p.status === 'failed') {
        out.push({
          id: `pay-${p.id}`,
          tone: 'danger',
          title: "We couldn't verify your payment",
          body: p.failureReason ?? 'Check the UTR and submit it again.',
          href: '/owner/plan',
          linkLabel: 'Submit again',
        })
      }
    }
    return out.filter((u) => !seen.has(u.id))
  }, [student.data, owner.data, seen])

  return {
    updates,
    dismiss: (id: string) => user && markSeen(user.id, [id]),
    dismissAll: () => user && markSeen(user.id, updates.map((u) => u.id)),
  }
}
