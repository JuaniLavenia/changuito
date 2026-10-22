import type { Unit } from '@changuito/domain'

export const UNIT_LABELS: Record<Unit, { singular: string; plural: string }> = {
  unit: { singular: 'unidad', plural: 'unidades' },
  kg: { singular: 'kg', plural: 'kg' },
  g: { singular: 'g', plural: 'g' },
  l: { singular: 'litro', plural: 'litros' },
  ml: { singular: 'ml', plural: 'ml' },
  pack: { singular: 'paquete', plural: 'paquetes' },
}

const numberFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 })

export function formatQuantity(quantity: number, unit: Unit): string {
  const label = UNIT_LABELS[unit]
  return `${numberFormat.format(quantity)} ${quantity === 1 ? label.singular : label.plural}`
}

const priceFormat = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

export function formatPrice(price: number): string {
  return priceFormat.format(price)
}
