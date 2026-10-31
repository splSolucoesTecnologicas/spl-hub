import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('metadados da página', () => {
  it('define favicon e cartão de compartilhamento da SPL', () => {
    expect(pageHtml).toContain('rel="icon" type="image/svg+xml" href="/SPL-Icone-App-Preto.svg"')
    expect(pageHtml).toContain('property="og:image" content="https://splsolucoes.com/social-preview.png"')
    expect(pageHtml).toContain('name="twitter:card" content="summary_large_image"')
  })

  it('gera imagem social PNG no tamanho 1200 por 630', () => {
    const image = readFileSync(resolve(process.cwd(), 'public/social-preview.png'))

    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(image.readUInt32BE(16)).toBe(1200)
    expect(image.readUInt32BE(20)).toBe(630)
  })
})
