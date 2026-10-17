import { DEFAULT_SHIFTS } from '@/domain/shifts'
import type { ShiftInput } from '@/domain/types'

/** A local, editable shift row for the onboarding form. `fee` is the rupee string the owner types. */
export type ShiftDraft = {
  name: string
  startTime: string
  endTime: string
  fee: string
}

/** The default shifts as blank-fee drafts, for a brand-new library. */
export function defaultShiftDrafts(): ShiftDraft[] {
  return DEFAULT_SHIFTS.map((d) => ({ name: d.name, startTime: d.startTime, endTime: d.endTime, fee: '' }))
}

/** Rupees typed in a row -> integer paise, or -1 so validation flags it. */
export function draftFeePaise(fee: string): number {
  const cleaned = fee.replace(/[,\s₹]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return -1
  return Math.round(Number(cleaned) * 100)
}

/** Turn local drafts into the ShiftInput[] that `createLibrary` expects. */
export function draftsToShiftInputs(drafts: ShiftDraft[]): ShiftInput[] {
  return drafts.map((d) => ({
    name: d.name.trim(),
    startTime: d.startTime,
    endTime: d.endTime,
    monthlyFeePaise: draftFeePaise(d.fee),
  }))
}
