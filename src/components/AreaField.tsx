import { TextField } from '@/components/Fields'
import { cleanArea, MAX_AREA_LENGTH } from '@/domain/areas'

type Props = {
  value: string
  onChange: (value: string) => void
  error?: string
}

/** The owner types the area by hand. There is no list and no suggestion (D-045). Extra spaces are tidied on leaving the field. */
export function AreaField({ value, onChange, error }: Props) {
  return (
    <TextField
      label="Area (optional)"
      hint="Your locality, e.g. Gomti Nagar."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        const tidy = cleanArea(value)
        if (tidy !== value) onChange(tidy)
      }}
      error={error}
      maxLength={MAX_AREA_LENGTH}
      autoComplete="off"
    />
  )
}
