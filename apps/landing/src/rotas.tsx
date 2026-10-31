import { useEffect, useState } from 'react'
import App from './App'
import { BlogIndexPage, BlogPostPage } from './blog/BlogPages'
import { noticiasNoBuild, temBlog, type NoticiaPublica } from './blog/noticias'
import { SiteFooter, SiteNavigation } from './components/SiteChrome'

function PaginaNaoEncontrada() {
  return (
    <>
      <SiteNavigation />
      <main className="pagina-simples">
        <div className="wrap">
          <h1 className="section-title">Página não encontrada.</h1>
          <a className="more" href="/">Voltar ao início</a>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

export function Rotas({ noticias = noticiasNoBuild(), caminhoInicial }: { noticias?: NoticiaPublica[]; caminhoInicial?: string }) {
  const [caminho, setCaminho] = useState(caminhoInicial ?? window.location.pathname)
  useEffect(() => {
    const aoVoltar = () => setCaminho(window.location.pathname)
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  const publicado = temBlog(noticias)
  if (!publicado && (caminho === '/blog' || caminho.startsWith('/blog/'))) return <PaginaNaoEncontrada />
  if (caminho === '/blog') return <BlogIndexPage noticias={noticias} />
  if (caminho.startsWith('/blog/')) {
    return <BlogPostPage slug={decodeURIComponent(caminho.slice('/blog/'.length))} noticias={noticias} />
  }
  return <App noticias={noticias} />
}
