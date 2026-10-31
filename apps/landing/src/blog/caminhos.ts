/** Páginas estáticas do blog. Lista vazia não gera rota nenhuma. */
export function caminhosDoBlog(noticias: { slug: string }[]): string[] {
  if (noticias.length === 0) return []
  return ['blog', ...noticias.map((noticia) => `blog/${noticia.slug}`)]
}
