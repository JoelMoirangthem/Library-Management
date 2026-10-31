import { TextField } from '@/components/Fields'
import { cleanArea, MAX_AREA_LENGTH } from '@/domain/areas'

type Props = {
  value: string
  onChange: (value: string) => void
  error?: string
}

/**
 * The owner types the area by hand. There is no list and no suggestion (D-045).
 * Extra spaces are tidied on leaving the field. The length limit is checked on the tidied text by the form's validation
 * and by the database, not with `maxLength`: that would count raw characters and could cut off a pasted name that is
 * valid once its extra spaces are gone.
 */
export function AreaField({ value, onChange, error }: Props) {
  return (
    <TextField
      label="Area (optional)"
      hint={`Your locality, e.g. Gomti Nagar. Up to ${MAX_AREA_LENGTH} characters.`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        const tidy = cleanArea(value)
        if (tidy !== value) onChange(tidy)
      }}
      error={error}
      autoComplete="off"
    />
  )
}
