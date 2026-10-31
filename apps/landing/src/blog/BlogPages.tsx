import { useEffect, useState } from 'react'
import { SiteFooter, SiteNavigation } from '../components/SiteChrome'
import { carregarNoticia, carregarNoticias, type NoticiaPublica } from './noticias'

export function BlogIndexPage({ noticias: iniciais }: { noticias: NoticiaPublica[] }) {
  const [noticias, setNoticias] = useState<NoticiaPublica[]>(iniciais)
  useEffect(() => {
    if (!import.meta.env.VITE_API_URL) return
    void carregarNoticias().then((lista) => { if (lista.length > 0) setNoticias(lista) })
  }, [])
  return (
    <>
      <SiteNavigation mostrarBlog />
      <main className="blog-page">
        <div className="wrap">
          <a className="more" href="/">← Início</a>
          <div className="eyebrow">Notícias</div>
          <h1 className="section-title">Blog</h1>
          <div className="cards">
            {noticias.map((noticia) => (
              <a className="card" key={noticia.slug} href={`/blog/${noticia.slug}`}>
                <h3>{noticia.titulo}</h3>
                <p>{noticia.resumo}</p>
                <span className="more">Ler nota →</span>
              </a>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter mostrarBlog />
    </>
  )
}

export function BlogPostPage({ slug, noticias }: { slug: string; noticias: NoticiaPublica[] }) {
  const [noticia, setNoticia] = useState<NoticiaPublica | null>(() => noticias.find((item) => item.slug === slug) ?? null)
  useEffect(() => {
    if (!import.meta.env.VITE_API_URL) return
    void carregarNoticia(slug).then(setNoticia)
  }, [slug])
  return (
    <>
      <SiteNavigation mostrarBlog />
      <main className="blog-page">
        <div className="wrap artigo">
          <a className="more" href="/blog">← Blog</a>
          {noticia === null && <p className="lead">Esta nota não está disponível.</p>}
          {noticia && (
            <>
              <div className="eyebrow">{noticia.exemplo ? 'Publicação de exemplo' : noticia.autorNome}</div>
              <h1 className="section-title">{noticia.titulo}</h1>
              <p className="lead">{noticia.resumo}</p>
              {noticia.corpo.split('\n').filter(Boolean).map((paragrafo) => <p key={paragrafo}>{paragrafo}</p>)}
            </>
          )}
        </div>
      </main>
      <SiteFooter mostrarBlog />
    </>
  )
}
