import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppRoutes } from '@/app/AppRoutes'
import { casa, FakeCatalogRepository, FakeHouseholdRepository, product, renderWithProviders } from '@/test/fakes'

const renderCatalog = (catalog: FakeCatalogRepository) =>
  renderWithProviders(<AppRoutes />, {
    path: '/catalogo',
    repositories: { households: new FakeHouseholdRepository([casa]), catalog },
  })

describe('CatalogPage', () => {
  it('lists products grouped by section in store order', async () => {
    renderCatalog(
      new FakeCatalogRepository([
        product({ id: 'p-milk', name: 'Leche', sectionId: 's-dairy', unit: 'l', expectedMonthlyConsumption: 8 }),
        product({ id: 'p-rice', name: 'Arroz', sectionId: 's-pantry', unit: 'kg', expectedMonthlyConsumption: 2 }),
      ]),
    )

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Almacén', 'Lácteos'])
    const dairy = screen.getByRole('region', { name: 'Lácteos' })
    expect(within(dairy).getByText('Leche')).toBeInTheDocument()
    expect(within(dairy).getByText('8 litros por mes')).toBeInTheDocument()
  })

  it('adds a new product with a preferred brand', async () => {
    const catalog = new FakeCatalogRepository()
    renderCatalog(catalog)

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar producto' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo producto' })
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Yerba')
    await userEvent.selectOptions(within(dialog).getByLabelText('Sección'), 'Almacén')
    await userEvent.selectOptions(within(dialog).getByLabelText('Unidad'), 'kg')
    await userEvent.clear(within(dialog).getByLabelText('Consumo por mes'))
    await userEvent.type(within(dialog).getByLabelText('Consumo por mes'), '2')
    await userEvent.type(within(dialog).getByLabelText('Marca preferida (opcional)'), 'Playadito')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Yerba')).toBeInTheDocument()
    expect(catalog.products).toEqual([
      {
        id: expect.any(String),
        name: 'Yerba',
        sectionId: 's-pantry',
        unit: 'kg',
        preferredBrand: 'Playadito',
        expectedMonthlyConsumption: 2,
      },
    ])
  })

  it('edits the expected monthly consumption of a product', async () => {
    const catalog = new FakeCatalogRepository([product({ id: 'p-milk', name: 'Leche', sectionId: 's-dairy', unit: 'l', expectedMonthlyConsumption: 8 })])
    renderCatalog(catalog)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Leche' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar producto' })
    await userEvent.clear(within(dialog).getByLabelText('Consumo por mes'))
    await userEvent.type(within(dialog).getByLabelText('Consumo por mes'), '10')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('10 litros por mes')).toBeInTheDocument()
    expect(catalog.products[0].expectedMonthlyConsumption).toBe(10)
  })

  it('removes a product from the catalog', async () => {
    const catalog = new FakeCatalogRepository([product({ id: 'p-milk', name: 'Leche' })])
    renderCatalog(catalog)

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Leche' }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar del catálogo' }))

    expect(await screen.findByText('Todavía no hay productos en el catálogo.')).toBeInTheDocument()
    expect(catalog.products).toEqual([])
  })

  it('refuses to save without a name or with a negative consumption', async () => {
    renderCatalog(new FakeCatalogRepository())

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar producto' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo producto' })
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()

    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Yerba')
    await userEvent.clear(within(dialog).getByLabelText('Consumo por mes'))
    await userEvent.type(within(dialog).getByLabelText('Consumo por mes'), '-1')
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('creates a new section from the product form', async () => {
    const catalog = new FakeCatalogRepository()
    renderCatalog(catalog)

    await userEvent.click(await screen.findByRole('button', { name: 'Agregar producto' }))
    const dialog = screen.getByRole('dialog', { name: 'Nuevo producto' })
    await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Pañales')
    await userEvent.selectOptions(within(dialog).getByLabelText('Sección'), 'Nueva sección…')
    await userEvent.type(within(dialog).getByLabelText('Nombre de la sección'), 'Bebés')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('region', { name: 'Bebés' })).toBeInTheDocument()
    expect(catalog.products[0].sectionId).toBe(catalog.sections.find((s) => s.name === 'Bebés')?.id)
  })
})
