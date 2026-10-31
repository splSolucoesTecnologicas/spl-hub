import { usePageInteractions } from '../hooks/usePageInteractions'
import { Brand } from './Brand'

export function SiteNavigation({ mostrarBlog = false }: { mostrarBlog?: boolean }) {
  const isScrolled = usePageInteractions()

  return (
    <nav id="nav" className={isScrolled ? 'scrolled' : undefined}>
      <div className="nav-inner">
        <Brand />
        <div className="nav-actions">
        {mostrarBlog && <a className="nav-blog" href="/blog">Blog</a>}
        <a className="btn" href="https://wa.me/5562994614940" target="_blank" rel="noopener noreferrer">
          <span className="btn-full">Falar sobre um projeto</span>
          <span className="btn-short">Contato</span>
          <span className="arr" aria-hidden="true">→</span>
        </a>
        </div>
      </div>
    </nav>
  )
}

export function SiteFooter({ mostrarBlog = false }: { mostrarBlog?: boolean }) {
  return (
    <footer>
      <div className="wrap foot-grid">
        <Brand compact />
        <nav className="foot-links" aria-label="Navegação do rodapé">
          <a href="#solucoes">Soluções</a>
          <a href="#thumdra">Thumdra</a>
          <a href="#abordagem">Como construímos</a>
          <a href="#quem-somos">Quem somos</a>
          <a href="#parceiros">Parceiros</a>
          <a href="#processo">Como jogamos</a>
          <a href="#contato">Contato</a>
          {mostrarBlog && <a href="/blog">Blog</a>}
        </nav>
        <div className="foot-note">
          <span>© 2026 SPL Soluções Tecnológicas LTDA. Todos os direitos reservados.</span>
          <span>Estratégia · Tecnologia · Resultados</span>
          <span className="foot-legal">CNPJ 63.951.440/0001-44 · Rua 10, Nº 250, Sala 401, Setor Oeste, Goiânia - GO, CEP 74.120-020 · Feito no Brasil</span>
        </div>
      </div>
    </footer>
  )
}
