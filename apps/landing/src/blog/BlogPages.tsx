import { useEffect, useState } from 'react'
import { SiteFooter, SiteNavigation } from '../components/SiteChrome'
import { carregarNoticia, carregarNoticias, noticiasNoBuild, type NoticiaPublica } from './noticias'

export function BlogIndexPage() {
  const [noticias, setNoticias] = useState<NoticiaPublica[]>(noticiasNoBuild)
  useEffect(() => {
    if (!import.meta.env.VITE_API_URL) return
    void carregarNoticias().then(setNoticias)
  }, [])
  return (
    <>
      <SiteNavigation />
      <main className="blog-page">
        <div className="wrap">
          <a className="more" href="/">← Início</a>
          <div className="eyebrow">Notícias</div>
          <h1 className="section-title">Blog</h1>
          {noticias.length === 0 && <p className="lead">Nenhuma publicação no momento.</p>}
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
      <SiteFooter />
    </>
  )
}

export function BlogPostPage({ slug }: { slug: string }) {
  const [noticia, setNoticia] = useState<NoticiaPublica | null>(() => noticiasNoBuild().find((item) => item.slug === slug) ?? null)
  useEffect(() => {
    if (!import.meta.env.VITE_API_URL) return
    void carregarNoticia(slug).then(setNoticia)
  }, [slug])
  return (
    <>
      <SiteNavigation />
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
      <SiteFooter />
    </>
  )
}
