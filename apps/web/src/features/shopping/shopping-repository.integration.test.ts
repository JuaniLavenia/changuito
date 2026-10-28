// Runs against the local Supabase stack: `pnpm db:start`, then `pnpm --filter @changuito/web test:integration`.
import { describeIntegration, signedInClient } from '@/test/integration'
import { createSupabaseCatalogRepository } from '@/features/catalog/catalog-repository'
import { createSupabaseHouseholdRepository } from '@/features/households/household-repository'
import { createSupabaseShoppingRepository, currentPeriod } from './shopping-repository'

describeIntegration('Supabase shopping repository', () => {
  it('creates the list from a stock review and carries skipped items to the next month', async () => {
    const client = await signedInClient(`shopping-${Date.now()}@example.com`)
    const household = await createSupabaseHouseholdRepository(client).create('Casa', [
      {
        name: 'Almacén',
        products: [
          { name: 'Aceite', unit: 'l', expected: 1 },
          { name: 'Arroz', unit: 'kg', expected: 2 },
        ],
      },
    ])
    const products = await createSupabaseCatalogRepository(client).listProducts(household.id)
    const oil = products.find((p) => p.name === 'Aceite')!
    const rice = products.find((p) => p.name === 'Arroz')!
    const shopping = createSupabaseShoppingRepository(client)

    expect(await shopping.getOpenList(household.id)).toBeNull()
    expect(await shopping.getCarryOver(household.id)).toEqual([])

    const list = await shopping.createList(household.id, { [oil.id]: 0, [rice.id]: 2 }, [
      { productId: oil.id, quantity: 1.5, carriedOver: false },
    ])
    expect(list).toMatchObject({ period: currentPeriod(), status: 'draft' })
    expect(await shopping.getOpenList(household.id)).toEqual(list)

    // Close it with the oil skipped, as T8 will do from the UI.
    await client.from('list_items').update({ status: 'skipped', skip_reason: 'too_expensive' }).eq('list_id', list.id)
    const { error } = await client.rpc('close_shopping_list', { p_list_id: list.id })
    expect(error).toBeNull()

    expect(await shopping.getOpenList(household.id)).toBeNull()
    expect(await shopping.getCarryOver(household.id)).toEqual([{ productId: oil.id, quantity: 1.5 }])
  })
})
