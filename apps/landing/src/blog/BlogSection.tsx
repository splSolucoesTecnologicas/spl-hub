import { useEffect, useState } from 'react'
import { carregarNoticias, type NoticiaPublica } from './noticias'

export function BlogSection({ noticias: iniciais }: { noticias: NoticiaPublica[] }) {
  const [noticias, setNoticias] = useState<NoticiaPublica[]>(iniciais)

  useEffect(() => {
    if (!import.meta.env.VITE_API_URL || iniciais.length === 0) return
    let ativo = true
    void carregarNoticias().then((lista) => { if (ativo && lista.length > 0) setNoticias(lista) })
    return () => { ativo = false }
  }, [iniciais.length])

  if (noticias.length === 0) return null

  const lista = noticias

  return (
    <section id="blog" className="blog">
      <div className="wrap">
        <div className="eyebrow">Notícias</div>
        <h2 className="section-title">O que a SPL<br /><span className="g">está movendo.</span></h2>
        {lista.length === 0 ? (
          <p className="lead">Nenhuma publicação no momento.</p>
        ) : (
          <div className="cards">
            {lista.map((noticia) => (
              <a className="card" key={noticia.slug} href={`/blog/${noticia.slug}`}>
                {noticia.exemplo && <div className="num">EXEMPLO</div>}
                <h3>{noticia.titulo}</h3>
                <p>{noticia.resumo}</p>
                <span className="more">Ler nota →</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
