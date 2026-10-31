import { describe, expect, it } from 'vitest'
import { caminhosDoBlog } from './caminhos'

describe('rotas estáticas do blog', () => {
  it('não gera /blog quando não há notícia publicada', () => {
    expect(caminhosDoBlog([])).toEqual([])
  })

  it('gera o índice e cada slug quando há notícia', () => {
    expect(caminhosDoBlog([{ slug: 'hub-hexagonal' }, { slug: 'thumdra' }])).toEqual([
      'blog',
      'blog/hub-hexagonal',
      'blog/thumdra',
    ])
  })
})
