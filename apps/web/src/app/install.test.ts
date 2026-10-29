import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const webRoot = path.resolve(__dirname, '../..')
const publicDir = path.join(webRoot, 'public')
const indexHtml = readFileSync(path.join(webRoot, 'index.html'), 'utf8')

interface ManifestIcon {
  src: string
  sizes: string
  purpose?: string
}

const readManifest = () => JSON.parse(readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'))

describe('installable app', () => {
  it('ships a manifest that meets the install criteria for Android', () => {
    const manifest = readManifest()

    expect(manifest).toMatchObject({ name: 'Changuito', short_name: 'Changuito', start_url: '/', display: 'standalone' })
    const sizes = manifest.icons.map((icon: ManifestIcon) => icon.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((icon: ManifestIcon) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons as ManifestIcon[]) {
      expect(existsSync(path.join(publicDir, icon.src))).toBe(true)
    }
  })

  it('links the manifest, favicon and iOS home screen icon from the page', () => {
    for (const href of ['/manifest.webmanifest', '/favicon.svg', '/icons/apple-touch-icon.png']) {
      expect(indexHtml).toContain(`href="${href}"`)
      expect(existsSync(path.join(publicDir, href))).toBe(true)
    }
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />')
  })
})
