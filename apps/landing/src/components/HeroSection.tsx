import queenImage from '../../queen.png'

export function HeroSection() {
  return (
    <header className="hero" id="top">
      <div className="hero-floor" />
      <div className="hero-glow" />
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow rv">Estratégia · Tecnologia · Resultados</div>
          <h1 className="rv d1">Do desafio<br />ao <span className="g">produto.</span></h1>
          <p className="lead rv d2">Transformamos necessidades de negócio em software, com <strong>estratégia, tecnologia</strong> e um time preparado para executar.</p>
          <div className="hero-cta rv d3">
            <a className="btn solid" href="#contato">Falar sobre o seu projeto <span className="arr" aria-hidden="true">→</span></a>
            <a className="btn" href="#thumdra">Conhecer a Thumdra</a>
          </div>
        </div>
        <div className="hero-piece rv d2">
          <img src={queenImage} alt="Peça de xadrez dama em preto e verde" />
        </div>
      </div>
      <div className="hero-side" aria-label="Navegação rápida">
        <a href="#thumdra">Thumdra</a><a href="#solucoes">Soluções</a><a href="#processo">Como jogamos</a><a href="#abordagem">Como construímos</a><a href="#quem-somos">Quem somos</a><a href="#contato">Contato</a>
      </div>
      <div className="scroll-hint" aria-hidden="true" />
    </header>
  )
}
