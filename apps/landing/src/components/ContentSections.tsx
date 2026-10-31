import advocaciaLogo from '../../advocacia-castro-ferreira.png'
import knightImage from '../../knight.jpg'
import sergioImage from '../../sergio-lustosa.jpg'

function ExpoenteLogo() {
  return (
    <svg className="expoente-logo" viewBox="0 0 660 120" role="img" aria-label="Expoente">
      <defs>
        <linearGradient id="expBase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B15CFF" /><stop offset="1" stopColor="#7B2CBF" />
        </linearGradient>
        <linearGradient id="expHi" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3E4FF" /><stop offset="1" stopColor="#C084FC" />
        </linearGradient>
        <mask id="expBite"><rect x="0" y="0" width="100" height="100" fill="#fff" /><circle cx="72" cy="31" r="14" fill="#000" /></mask>
      </defs>
      <text x="6" y="88" fontFamily="'Helvetica Neue', Inter, Arial, sans-serif" fontWeight="200" fontSize="96" letterSpacing="10" fill="#ffffff">EXPOENTE</text>
      <g transform="translate(566,4) scale(0.42)">
        <circle cx="45" cy="57" r="30" fill="url(#expBase)" mask="url(#expBite)" />
        <circle cx="72" cy="31" r="11" fill="url(#expHi)" />
      </g>
    </svg>
  )
}

const partners = [
  {
    name: 'Expoente Marketing',
    url: 'https://expoente.marketing',
    description: 'Transformando ideias em resultados. A Expoente Marketing é uma assessoria digital especializada em soluções criativas para alavancar o seu negócio.',
    logo: <ExpoenteLogo />,
  },
  {
    name: 'Advocacia Sarah de Castro',
    url: 'https://www.advocaciacastroferreira.com.br',
    description: 'Especialistas em direito trabalhista empresarial, defesa de sócios e recuperação judicial em São Paulo.',
    logo: <span className="partner-chip"><img src={advocaciaLogo} alt="Logo da Advocacia Sarah de Castro" /></span>,
  },
]

export function PartnersSection() {
  return (
    <section id="parceiros" className="partners">
      <div className="wrap">
        <div className="eyebrow rv">Parceiros</div>
        <h2 className="section-title rv d1">Parceiros que jogam<br /><span className="g">com a gente.</span></h2>
        <div className="partner-grid">
          {partners.map((partner, index) => (
            <a className={`partner-card rv d${index + 1}`} key={partner.name} href={partner.url} target="_blank" rel="noopener noreferrer">
              <div className="partner-logo">{partner.logo}</div>
              <h3>{partner.name}</h3>
              <p>{partner.description}</p>
              <span className="more">Visitar site →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Marquee() {
  const message = <>Estratégia <i className="dot">·</i> Tecnologia <i className="dot">·</i> Resultados <i className="dot">·</i> O futuro em movimento <i className="dot">·</i> Software sob medida <i className="dot">·</i> Produtos digitais <i className="dot">·</i> White label <i className="dot">·</i></>

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track"><span>{message}</span><span>{message}</span></div>
    </div>
  )
}

export function ManifestoSection() {
  return (
    <section className="manifesto">
      <div className="wrap mani-text">
        <div className="eyebrow rv">Nosso manifesto</div>
        <p className="mani-quote rv d1">Saber desenvolver é importante.<br /><span className="g">Saber jogar o jogo é essencial.</span></p>
        <p className="mani-note rv d2">Unimos visão de negócio, tecnologia e execução para construir soluções que realmente fazem sentido gerando impacto real para empresas, produtos e pessoas.</p>
        <div className="mani-tag rv d3">Estratégia em cada movimento</div>
      </div>
    </section>
  )
}

const solutions = [
  { number: '01', title: 'Software sob medida', description: 'Sistemas, plataformas e soluções personalizadas para o seu negócio, do escopo à entrega.', icon: <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /><path d="m9.5 9.5 5 5m0-5-5 5" /></> },
  { number: '02', title: 'Produtos digitais', description: 'Da ideia ao mercado: criamos e evoluímos produtos escaláveis com visão de longo prazo.', icon: <><path d="m12 2 10 5-10 5L2 7l10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></> },
  { number: '03', title: 'Soluções White Label', description: 'A tecnologia certa com a sua marca, pronta para o seu mercado sem construir do zero.', icon: <><path d="M20 7h-9m9 10h-9M4 7h.01M4 17h.01" /><rect x="2" y="4" width="20" height="6" rx="2" /><rect x="2" y="14" width="20" height="6" rx="2" /></> },
]

export function SolutionsSection() {
  return (
    <section id="solucoes" className="solutions">
      <div className="sol-deco l" aria-hidden="true"><img src={knightImage} alt="" /></div>
      <div className="sol-deco r" aria-hidden="true"><img src={knightImage} alt="" /></div>
      <div className="wrap">
        <div className="eyebrow rv">O que fazemos</div>
        <h2 className="section-title rv d1">Soluções para o seu<br /><span className="g">próximo movimento.</span></h2>
        <div className="cards">
          {solutions.map((solution, index) => (
            <article className={`card rv d${index + 1}`} key={solution.number}>
              <div className="num">{solution.number}</div>
              <div className="ic"><svg viewBox="0 0 24 24" aria-hidden="true">{solution.icon}</svg></div>
              <h3>{solution.title}</h3>
              <p>{solution.description}</p>
              <span className="more">Saiba mais →</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ThumdraSection() {
  return (
    <section className="thumdra" id="thumdra">
      <div className="wrap thm-grid">
        <div>
          <div className="eyebrow rv">Prova real</div>
          <h2 className="section-title rv d1 thm-title">Thumdra<span className="g">.</span></h2>
          <div className="thm-badge rv d2">Projeto desenvolvido na SPL</div>
          <p className="lead rv d2"><strong>Nós também construímos nossos próprios produtos.</strong> A Thumdra é o nosso CRM completo com automação e gestão comercial que centraliza operações, organiza contatos, estrutura pipelines, cria campanhas e automatiza processos.</p>
          <div className="thm-models">
            <article className="thm-model rv d3"><h3><span>◈</span> Consumo padrão</h3><p>Use a plataforma pronta, com a marca Thumdra... assine e comece a operar hoje.</p></article>
            <article className="thm-model rv d4"><h3><span>◈</span> White label</h3><p>A mesma tecnologia com a <em>sua marca</em>, para revender ao seu mercado.</p></article>
          </div>
          <a className="thm-link rv d4" href="https://thumdra.com" target="_blank" rel="noopener noreferrer">Conhecer em <em>thumdra.com</em> →</a>
        </div>
        <div className="rv d2">
          <ThumdraMockup />
        </div>
      </div>
    </section>
  )
}

function ThumdraMockup() {
  return (
    <div className="thm-mock" aria-hidden="true">
      <div className="tm-card tm-screen">
        <div className="tm-topbar">
          <i className="tm-dot r" /><i className="tm-dot y" /><i className="tm-dot g" />
          <span className="tm-url">thumdra.com</span>
        </div>
        <div className="tm-screen-body">
          <div className="tm-kpi-row">
            <div className="tm-kpi"><small>Mensagens</small><b>4.820<span>/20000</span></b></div>
            <div className="tm-kpi"><small>Contatos</small><b>1.240<span>/9999</span></b></div>
            <div className="tm-kpi"><small>Pipelines</small><b>3<span>/10</span></b></div>
          </div>
          <div className="tm-rows"><i /><i /><i /></div>
        </div>
      </div>

      <div className="tm-card tm-funil">
        <div className="tm-funil-head"><span>Funil · Vendas</span><b>128</b></div>
        <ul>
          <li><span>Lead</span><div className="tm-bar"><i style={{ width: '100%' }} /></div><b>42</b></li>
          <li><span>Qualificação</span><div className="tm-bar"><i style={{ width: '74%' }} /></div><b>31</b></li>
          <li><span>Proposta</span><div className="tm-bar"><i style={{ width: '43%' }} /></div><b>18</b></li>
          <li><span>Fechado</span><div className="tm-bar dark"><i style={{ width: '57%' }} /></div><b>24</b></li>
        </ul>
      </div>

      <div className="tm-card tm-campaigns">
        <div className="tm-campaigns-head"><span>Campanhas</span></div>
        <div className="tm-campaign">
          <div className="tm-campaign-row"><b>Black Friday Antecipada</b><span className="tm-status done">Concluída</span></div>
          <div className="tm-bar"><i style={{ width: '100%' }} /></div>
          <small>940 enviadas</small>
        </div>
        <div className="tm-campaign">
          <div className="tm-campaign-row"><b>Follow-up Leads Quentes</b><span className="tm-status sending">Enviando</span></div>
          <div className="tm-bar"><i style={{ width: '42%' }} /></div>
          <small>380 enviadas</small>
        </div>
      </div>

      <div className="tm-card tm-chat">
        <div className="tm-chat-head">
          <span className="tm-avatar">CD</span>
          <div><b>Camila Duarte</b><small>WhatsApp · Lead</small></div>
        </div>
        <div className="tm-chat-body">
          <p className="in">Oi! Vi o anúncio, ainda tem horário essa semana?</p>
          <p className="out">Tem sim! Posso reservar amanhã às 09:00? ✓✓</p>
          <span className="tm-auto">⚡ Automação ativa</span>
        </div>
      </div>

      <div className="tm-card tm-stat">
        <b>847</b>
        <small>Disparos hoje</small>
      </div>
    </div>
  )
}

const triangle = [
  { number: '01', title: 'Escopo', description: 'Definimos exatamente o que precisa existir pra validar sua ideia — nada além disso, nada de menos.' },
  { number: '02', title: 'Tempo', description: 'MVP no ar rápido, sem sacrificar o que sustenta o produto quando ele começar a crescer.' },
  { number: '03', title: 'Valor', description: 'Investimento proporcional ao impacto real pro seu negócio — sem gordura, sem promessa vazia.' },
]

export function ApproachSection() {
  return (
    <section id="abordagem" className="approach">
      <div className="wrap">
        <div className="eyebrow rv">Como construímos</div>
        <h2 className="section-title rv d1">Escopo, tempo e valor<br /><span className="g">em equilíbrio.</span></h2>
        <p className="lead rv d2">Construímos sistemas empresariais focados em nicho, com MVP, segurança e performance como prioridade desde a primeira linha de código. E sabemos que escopo, tempo e valor sempre competem entre si: nosso trabalho é ajudar você a decidir onde vale apertar, e onde não.</p>
        <div className="cards">
          {triangle.map((item, index) => (
            <article className={`card rv d${index + 1}`} key={item.number}>
              <div className="num">{item.number}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const founders = [
  { name: 'Sérgio Paulo Lustosa', role: 'Nosso representante · CEO', photo: sergioImage },
]

export function TeamSection() {
  return (
    <section id="quem-somos" className="team">
      <div className="wrap team-wrap">
        <div className="eyebrow rv">Quem está por trás da SPL</div>
        <h2 className="section-title team-title rv d1">Assim como a Dama no Xadrez,<br /><span className="g">queremos ser uma peça estratégica e versátil no jogo</span></h2>
        <p className="lead rv d2">Somos uma equipe jovem que se uniu para construir um ecossistema completo de tecnologia. Aqui, resultado é consequência e o que vem primeiro é confiança: um time que se importa de verdade com as pessoas e faz um trabalho honesto, do jeito certo.</p>
        <p className="lead rv d2">Um time de desenvolvedores com experiência de mercado, construindo soluções robustas e escaláveis para o próximo movimento do seu negócio.</p>
        <div className="team-grid">
          {founders.map((founder, index) => (
            <article className={`founder-card rv d${index + 2}`} key={founder.name}>
              <img className="founder-photo" src={founder.photo} alt={founder.name} />
              <h3>{founder.name}</h3>
              <span className="role">{founder.role}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ContactSection() {
  return (
    <section className="cta" id="contato">
      <div className="cta-bg" />
      <div className="cta-glow" aria-hidden="true" />
      <div className="wrap cta-inner">
        <div className="eyebrow rv">O futuro em movimento</div>
        <h2 className="rv d1">Sua próxima jogada<br /><span className="g">começa aqui.</span></h2>
        <p className="rv d2">Tem uma ideia, um processo para automatizar ou um software que sua empresa precisa construir? Vamos conversar.</p>
        <a className="btn solid rv d3" href="https://wa.me/5562994614940" target="_blank" rel="noopener noreferrer">Falar sobre o seu projeto <span className="arr" aria-hidden="true">→</span></a>
      </div>
    </section>
  )
}
