import { afterEach, describe, expect, it, vi } from 'vitest'
import { carregarNoticia, carregarNoticias, noticiasNoBuild } from './noticias'

afterEach(() => { vi.unstubAllGlobals() })

describe('blog estático da landing', () => {
  it('sem URL de API devolve só o que foi embutido no build e não chama a rede', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(carregarNoticias(undefined)).resolves.toEqual(noticiasNoBuild())
    await expect(carregarNoticia('qualquer', undefined)).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('se a API falha, mantém o conteúdo do build', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    await expect(carregarNoticias('https://api.exemplo')).resolves.toEqual(noticiasNoBuild())
    await expect(carregarNoticia('qualquer', 'https://api.exemplo')).resolves.toBeNull()
  })

  it('atualiza com a API pública quando ela responde', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ slug: 'hub', titulo: 'Hub', resumo: 'r', corpo: 'c', publicadaEm: null, autorNome: 'SPL', exemplo: true }], nextCursor: null }), { status: 200 })))
    const lista = await carregarNoticias('https://api.exemplo')
    expect(lista[0]?.slug).toBe('hub')
  })
})
