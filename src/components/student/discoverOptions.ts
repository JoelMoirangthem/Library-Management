/** Fee options in paise. "Any" is the empty value. Shared by Discover and its filter sheet. */
export const FEE_OPTIONS = [
  { value: '80000', label: 'Up to ₹800' },
  { value: '100000', label: 'Up to ₹1,000' },
  { value: '120000', label: 'Up to ₹1,200' },
  { value: '150000', label: 'Up to ₹1,500' },
] as const

export type FeeOption = (typeof FEE_OPTIONS)[number]

/** Human label for a max-fee value, for the active-filter chip. */
export function feeOptionLabel(value: string): string {
  return FEE_OPTIONS.find((f) => f.value === value)?.label ?? `Up to ₹${Number(value) / 100}`
}
