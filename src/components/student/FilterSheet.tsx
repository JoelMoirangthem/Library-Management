import { Button } from '@/components/Button'
import { ChipCheckbox } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { AMENITIES } from '@/domain/constants'
import type { FeeOption } from '@/components/student/discoverOptions'

/**
 * The 'Filters' bottom sheet: max monthly fee and amenity chips.
 * Changes apply live (the result count updates); the footer button just closes the sheet.
 */
export function FilterSheet({
  open,
  onClose,
  maxFee,
  amenities,
  feeOptions,
  resultCount,
  onChangeMaxFee,
  onToggleAmenity,
  onClear,
}: {
  open: boolean
  onClose: () => void
  maxFee: string
  amenities: string[]
  feeOptions: readonly FeeOption[]
  resultCount: number
  onChangeMaxFee: (value: string) => void
  onToggleAmenity: (name: string, on: boolean) => void
  onClear: () => void
}) {
  const hasFilters = Boolean(maxFee || amenities.length)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      description="Narrow down by fee and amenities."
      footer={
        <>
          {hasFilters && (
            <Button variant="ghost" onClick={onClear}>
              Clear filters
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'library' : 'libraries'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Max monthly fee</legend>
          <div className="flex flex-wrap gap-2">
            <ChipCheckbox
              label="Any"
              checked={!maxFee}
              onChange={() => onChangeMaxFee('')}
            />
            {feeOptions.map((f) => (
              <ChipCheckbox
                key={f.value}
                label={f.label}
                checked={maxFee === f.value}
                onChange={(on) => onChangeMaxFee(on ? f.value : '')}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Amenities</legend>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <ChipCheckbox
                key={a}
                label={a}
                checked={amenities.includes(a)}
                onChange={(on) => onToggleAmenity(a, on)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
