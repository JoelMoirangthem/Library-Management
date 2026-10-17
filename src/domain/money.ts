/** Money is always integer paise. This only formats for display. */
export function formatRupees(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new Error(`Money must be whole paise, got ${paise}`)
  }
  const rupees = paise / 100
  const hasPaise = paise % 100 !== 0
  return (
    '₹' +
    new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(rupees)
  )
}
