/** Parses a quantity typed by a person ("1,5", "2", ""). Empty or invalid input is null. */
export function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
