// Runs against the local Supabase stack: `pnpm db:start`, then `pnpm --filter @changuito/web test:integration`.
import { describeIntegration, signedInClient } from '@/test/integration'
import { createSupabaseHouseholdRepository } from '@/features/households/household-repository'
import { createSupabaseCatalogRepository } from './catalog-repository'

describeIntegration('Supabase catalog repository', () => {
  it('lists, creates, edits and archives products of the household', async () => {
    const client = await signedInClient(`catalog-${Date.now()}@example.com`)
    const household = await createSupabaseHouseholdRepository(client).create('Casa', [
      { name: 'Lácteos', products: [{ name: 'Leche', unit: 'l', expected: 8 }] },
    ])
    const catalog = createSupabaseCatalogRepository(client)

    const [dairy] = await catalog.listSections(household.id)
    expect(dairy).toMatchObject({ name: 'Lácteos', sortOrder: 1 })
    const [milk] = await catalog.listProducts(household.id)
    expect(milk).toMatchObject({ name: 'Leche', unit: 'l', expectedMonthlyConsumption: 8, sectionId: dairy.id })

    const pantry = await catalog.createSection(household.id, 'Almacén')
    expect(pantry.sortOrder).toBe(2)
    const yerba = await catalog.createProduct(household.id, {
      name: 'Yerba',
      sectionId: pantry.id,
      unit: 'kg',
      preferredBrand: 'Playadito',
      expectedMonthlyConsumption: 2.5,
    })
    expect(yerba).toMatchObject({ preferredBrand: 'Playadito', expectedMonthlyConsumption: 2.5 })

    await catalog.updateProduct(milk.id, { ...milk, expectedMonthlyConsumption: 10 })
    await catalog.archiveProduct(yerba.id)

    expect(await catalog.listProducts(household.id)).toEqual([{ ...milk, expectedMonthlyConsumption: 10 }])
  })
})
