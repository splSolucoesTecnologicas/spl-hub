import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { NoticiaPublica } from './noticias'
import { Rotas } from '../rotas'

const publicada: NoticiaPublica = {
  slug: 'hub-hexagonal',
  titulo: 'O hub interno nasce em arquitetura hexagonal',
  resumo: 'Resumo da nota',
  corpo: 'Corpo da nota',
  publicadaEm: '2026-10-30T15:00:00.000Z',
  autorNome: 'Guilherme Segatto',
  exemplo: true,
}

afterEach(() => cleanup())

describe('blog visível só com notícia publicada', () => {
  it('sem notícia não mostra seção nem links', () => {
    render(<Rotas noticias={[]} caminhoInicial="/" />)

    expect(screen.queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument()
    expect(document.getElementById('blog')).not.toBeInTheDocument()
    expect(screen.queryByText(/notícias/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/nenhuma publicação/i)).not.toBeInTheDocument()
  })

  it('sem notícia, /blog e /blog/slug não existem', () => {
    const { unmount } = render(<Rotas noticias={[]} caminhoInicial="/blog" />)
    expect(screen.getByRole('heading', { name: /não encontrada/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument()
    unmount()

    render(<Rotas noticias={[]} caminhoInicial="/blog/hub-hexagonal" />)
    expect(screen.getByRole('heading', { name: /não encontrada/i })).toBeInTheDocument()
    expect(screen.queryByText(publicada.titulo)).not.toBeInTheDocument()
  })

  it('com notícia mostra a seção, o menu, a lista lateral e o rodapé', () => {
    render(<Rotas noticias={[publicada]} caminhoInicial="/" />)

    expect(screen.getAllByRole('link', { name: 'Blog' })).toHaveLength(3)
    expect(document.getElementById('blog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: publicada.titulo })).toBeInTheDocument()
  })

  it('com notícia, /blog e /blog/slug abrem a nota', () => {
    const { unmount } = render(<Rotas noticias={[publicada]} caminhoInicial="/blog" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Blog' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(publicada.titulo) })).toBeInTheDocument()
    unmount()

    render(<Rotas noticias={[publicada]} caminhoInicial="/blog/hub-hexagonal" />)
    expect(screen.getByRole('heading', { level: 1, name: publicada.titulo })).toBeInTheDocument()
  })
})
