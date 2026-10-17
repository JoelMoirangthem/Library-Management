import { FEE_MODES } from '@/domain/constants'
import type { FeeMode } from '@/domain/types'

/** Options for the payment-mode <select>, including a "no payment yet" sentinel. */
export const NO_PAYMENT = 'none'

export type FeeModeChoice = FeeMode | typeof NO_PAYMENT

export function isFeeMode(value: string): value is FeeMode {
  return FEE_MODES.some((m) => m.value === value)
}
