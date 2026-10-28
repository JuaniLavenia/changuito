// Runs against the local Supabase stack: `pnpm db:start`, then `pnpm --filter @changuito/web test:integration`.
import { checkItem, uncheckItem } from '@changuito/domain'
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

  it('lists the items with their product and records who put them in the cart', async () => {
    const client = await signedInClient(`super-${Date.now()}@example.com`)
    const household = await createSupabaseHouseholdRepository(client).create('Casa', [
      { name: 'Almacén', products: [{ name: 'Arroz', unit: 'kg', expected: 2 }] },
    ])
    const catalog = createSupabaseCatalogRepository(client)
    const [created] = await catalog.listProducts(household.id)
    const rice = await catalog.updateProduct(created.id, { ...created, preferredBrand: 'Gallo' })
    const shopping = createSupabaseShoppingRepository(client)
    const list = await shopping.createList(household.id, { [rice.id]: 0 }, [
      { productId: rice.id, quantity: 2, carriedOver: false },
    ])

    const [item] = await shopping.listItems(list.id)
    expect(item).toMatchObject({
      productId: rice.id,
      name: 'Arroz',
      sectionId: rice.sectionId,
      unit: 'kg',
      preferredBrand: 'Gallo',
      quantity: 2,
      status: 'pending',
      checkedBy: null,
      checkedByName: null,
    })

    const { data: auth } = await client.auth.getUser()
    await shopping.saveItem(checkItem(item, { userId: auth.user!.id, price: 1250.5, brand: 'Gallo' }))
    const [checked] = await shopping.listItems(list.id)
    expect(checked).toMatchObject({
      status: 'in_cart',
      price: 1250.5,
      brand: 'Gallo',
      checkedBy: auth.user!.id,
      checkedByName: expect.stringContaining('super-'),
    })

    await shopping.saveItem(uncheckItem(checked))
    expect((await shopping.listItems(list.id))[0]).toMatchObject({ status: 'pending', price: null, checkedBy: null })
  })
})
