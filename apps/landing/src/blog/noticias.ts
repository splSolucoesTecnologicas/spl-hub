import geradas from './geradas.json'

export interface NoticiaPublica {
  slug: string
  titulo: string
  resumo: string
  corpo: string
  publicadaEm: string | null
  autorNome: string
  exemplo: boolean
}

/** Notícias gravadas no artefato pelo script de build. Não depende da API na hora da visita. */
export function noticiasNoBuild(): NoticiaPublica[] {
  return geradas.noticias
}

export async function carregarNoticias(api = import.meta.env.VITE_API_URL as string | undefined): Promise<NoticiaPublica[]> {
  const estaticas = noticiasNoBuild()
  if (!api) return estaticas
  try {
    const resposta = await fetch(`${api.replace(/\/$/, '')}/blog?limite=50`, { signal: AbortSignal.timeout(2500) })
    if (!resposta.ok) return estaticas
    const corpo = await resposta.json() as { data?: NoticiaPublica[] }
    return corpo.data ?? estaticas
  } catch {
    return estaticas
  }
}

export async function carregarNoticia(slug: string, api = import.meta.env.VITE_API_URL as string | undefined): Promise<NoticiaPublica | null> {
  const local = noticiasNoBuild().find((noticia) => noticia.slug === slug) ?? null
  if (!api) return local
  try {
    const resposta = await fetch(`${api.replace(/\/$/, '')}/blog/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(2500) })
    if (resposta.status === 404) return null
    if (!resposta.ok) return local
    return await resposta.json() as NoticiaPublica
  } catch {
    return local
  }
}
