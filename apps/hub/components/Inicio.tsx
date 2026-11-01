'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { ClienteDTO, DecisaoDTO, LayoutInicioDTO, NoticiaPublicaDTO, ObjetivoDTO, ProjetoDTO, UsuarioDTO } from '@spl/contracts';
import { geocodificar } from '@spl/contracts';
import { ESTADOS } from '@/lib/brasil';
import { projetar } from '@/lib/geo';
import { api, type Pagina, type TarefaDTO } from '@/lib/api';
import { useSessao } from '@/lib/auth';
import { pode } from '@/lib/pode';

function quando(iso: string | null, atrasada: boolean) {
  if (!iso) return '';
  const data = new Date(iso);
  if (atrasada) return `Atrasada ${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  if (data.toDateString() === new Date().toDateString()) return 'hoje';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function pontoPessoa(pessoa: UsuarioDTO) {
  if (pessoa.latitude != null && pessoa.longitude != null) return projetar(pessoa.latitude, pessoa.longitude);
  if (!pessoa.cidade) return null;
  const geo = geocodificar(pessoa.cidade, pessoa.uf);
  return geo ? projetar(geo.lat, geo.lon) : null;
}

/** Quem divide a mesma cidade ganha um lugar proprio num anelzinho — um ponto por pessoa. */
function espalharColididos(lista: Marcador[]) {
  const grupos = new Map<string, Marcador[]>();
  for (const item of lista) {
    const chave = `${item.x.toFixed(1)},${item.y.toFixed(1)}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(item);
    else grupos.set(chave, [item]);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const raio = 4.2 + (grupo.length - 2) * 0.85;
    grupo.forEach((item, indice) => {
      const angulo = (indice / grupo.length) * Math.PI * 2 - Math.PI / 2;
      item.dx = Math.cos(angulo) * raio;
      item.dy = Math.sin(angulo) * raio;
    });
  }
  return lista;
}

const ALTURA_ROTULO = 13;
const DESVIOS = [0, -ALTURA_ROTULO, ALTURA_ROTULO, -26, 26, -39, 39, -52, 52];

type Marcador = { id: string; x: number; y: number; dx: number; dy: number; cor: string; nome: string; tipo: 'equipe' | 'cliente'; alvo?: string };
type Vista = { k: number; x: number; y: number };

/** Posiciona os rotulos em volta dos pontos sem deixar nenhum encostar no outro. */
function montarRotulos(marcadores: Marcador[], vista: Vista, mostrarClientes: boolean) {
  const ocupados: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const saida: (Marcador & { sx: number; sy: number; rx: number; ry: number; desvio: number; largura: number; esquerda: boolean })[] = [];
  const visiveis = marcadores
    .filter((item) => item.tipo === 'equipe' || mostrarClientes)
    .map((item) => ({ ...item, sx: item.x * vista.k + vista.x + item.dx, sy: item.y * vista.k + vista.y + item.dy }))
    .filter((item) => item.sx > -40 && item.sx < 680 && item.sy > -20 && item.sy < 660)
    .sort((a, b) => a.sy - b.sy);
  for (const item of visiveis) {
    const largura = item.nome.length * 5.3 + 8;
    const esquerda = item.sx > 520;
    for (const desvio of DESVIOS) {
      const ry = item.sy + 3.4 + desvio;
      const rx = esquerda ? item.sx - 7 - largura : item.sx + 7;
      const caixa = { x1: rx - 3, y1: ry - 9.5, x2: rx + largura, y2: ry + 4 };
      const bate = ocupados.some((c) => caixa.x1 < c.x2 && caixa.x2 > c.x1 && caixa.y1 < c.y2 && caixa.y2 > c.y1);
      if (bate) continue;
      ocupados.push(caixa);
      saida.push({ ...item, rx, ry, desvio, largura, esquerda });
      break;
    }
  }
  return saida;
}

const STATUS_ATIVO = new Set(['piloto', 'validacao', 'em_desenvolvimento', 'proposta']);
const CARDS_PADRAO = ['semana', 'equipe', 'clientes', 'projetosAtivos', 'noticias', 'tarefas', 'decisoes', 'objetivos'];
const TITULOS: Record<string, string> = {
  semana: 'Tarefas da semana', equipe: 'Equipe SPL', clientes: 'Clientes', projetosAtivos: 'Projetos ativos',
  noticias: 'Notícias', tarefas: 'Minhas tarefas', decisoes: 'Últimas decisões · sócios', objetivos: 'Objetivos do trimestre',
};

function layoutPadrao(): LayoutInicioDTO {
  return { ordem: [...CARDS_PADRAO], ocultos: [], minimizados: [], sidebarRecolhida: false };
}

function CardPainel({ id, editando, layout, onMover, onMinimizar, onOcultar, primeiro, ultimo, children }: {
  id: string; editando: boolean; layout: LayoutInicioDTO;
  onMover: (id: string, direcao: -1 | 1) => void; onMinimizar: (id: string) => void; onOcultar: (id: string) => void;
  primeiro: boolean; ultimo: boolean; children: React.ReactNode;
}) {
  const oculto = layout.ocultos.includes(id);
  const minimizado = layout.minimizados.includes(id);
  if (oculto && !editando) return null;
  return (
    <section className={`painel${oculto ? ' painel-oculto' : ''}`}>
      <h2>
        {TITULOS[id]}
        <span className="card-controles">
          {editando && <button type="button" onClick={() => onMover(id, -1)} disabled={primeiro} aria-label="Mover para cima">↑</button>}
          {editando && <button type="button" onClick={() => onMover(id, 1)} disabled={ultimo} aria-label="Mover para baixo">↓</button>}
          {editando && <button type="button" onClick={() => onOcultar(id)} aria-label={oculto ? 'Mostrar card' : 'Ocultar card'}>{oculto ? 'Mostrar' : 'Ocultar'}</button>}
          <button type="button" onClick={() => onMinimizar(id)} aria-label={minimizado ? 'Expandir' : 'Minimizar'}>{minimizado ? '+' : '−'}</button>
        </span>
      </h2>
      {!minimizado && children}
    </section>
  );
}

export function Inicio() {
  const { usuario, recarregar } = useSessao();
  const svgRef = useRef<SVGSVGElement>(null);
  const grupoRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const animacaoRef = useRef(0);
  const [vista, setVista] = useState<Vista>({ k: 1, x: 0, y: 0 });
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [projetos, setProjetos] = useState<ProjetoDTO[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [decisoes, setDecisoes] = useState<DecisaoDTO[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoDTO[]>([]);
  const [noticias, setNoticias] = useState<NoticiaPublicaDTO[]>([]);
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [tituloDecisao, setTituloDecisao] = useState('');
  const [tituloObjetivo, setTituloObjetivo] = useState('');
  const [editandoLayout, setEditandoLayout] = useState(false);
  const [layout, setLayout] = useState<LayoutInicioDTO>(() => usuario.layoutInicio ?? layoutPadrao());
  const primeiraRenderLayout = useRef(true);

  async function carregar() {
    const [time, quadro, blog] = await Promise.all([
      api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100').catch(() => ({ data: [], nextCursor: null })),
      api<Pagina<TarefaDTO>>('/tarefas?filtro=minhas&limite=10').catch(() => ({ data: [], nextCursor: null })),
      api<Pagina<NoticiaPublicaDTO>>('/blog?limite=3').catch(() => ({ data: [], nextCursor: null })),
    ]);
    setPessoas(time.data.filter((pessoa) => pessoa.ativo));
    setTarefas(quadro.data);
    setNoticias(blog.data);
    if (pode(usuario, 'clientes', 'so_frentes')) setClientes((await api<Pagina<ClienteDTO>>('/clientes?limite=100').catch(() => ({ data: [] }))).data);
    if (pode(usuario, 'projetos', 'so_frentes')) setProjetos((await api<Pagina<ProjetoDTO>>('/projetos?limite=100').catch(() => ({ data: [] }))).data);
    if (pode(usuario, 'socios', 'ler')) {
      setDecisoes((await api<{ data: DecisaoDTO[] }>('/decisoes').catch(() => ({ data: [] }))).data);
      setObjetivos((await api<{ data: ObjetivoDTO[] }>('/objetivos').catch(() => ({ data: [] }))).data);
    }
  }
  useEffect(() => { void carregar(); }, [usuario.id]);

  useEffect(() => {
    const svg = svgRef.current;
    const grupo = grupoRef.current;
    if (!svg || !grupo) return;
    const selecao = select(svg);
    const comportamento = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .translateExtent([[-120, -120], [760, 760]])
      .on('zoom', (evento) => {
        const t = evento.transform as ZoomTransform;
        select(grupo).attr('transform', t.toString());
        setVista({ k: t.k, x: t.x, y: t.y });
      });
    selecao.call(comportamento);
    zoomRef.current = comportamento;
    return () => { selecao.on('.zoom', null); cancelAnimationFrame(animacaoRef.current); };
  }, []);

  useEffect(() => {
    if (primeiraRenderLayout.current) { primeiraRenderLayout.current = false; return; }
    const tempo = setTimeout(() => {
      void api(`/acesso/usuarios/${usuario.id}`, { method: 'PATCH', body: JSON.stringify({ layoutInicio: layout }) }).then(recarregar).catch(() => undefined);
    }, 600);
    return () => clearTimeout(tempo);
  }, [layout]);

  /** Zoom com tween proprio: o mapa desliza em vez de pular de um quadro para o outro. */
  function aplicarZoom(fator: number | null) {
    const svg = svgRef.current;
    const comportamento = zoomRef.current;
    if (!svg || !comportamento) return;
    const selecao = select(svg);
    const de = zoomTransform(svg);
    const centro = 320;
    const escala = fator == null ? 1 : Math.min(14, Math.max(1, de.k * fator));
    const para = fator == null
      ? zoomIdentity
      : zoomIdentity.translate(centro - ((centro - de.x) / de.k) * escala, centro - ((centro - de.y) / de.k) * escala).scale(escala);
    const inicio = performance.now();
    cancelAnimationFrame(animacaoRef.current);
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / 380);
      const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      const k = de.k + (para.k - de.k) * e;
      const x = de.x + (para.x - de.x) * e;
      const y = de.y + (para.y - de.y) * e;
      comportamento.transform(selecao, zoomIdentity.translate(x, y).scale(k));
      if (p < 1) animacaoRef.current = requestAnimationFrame(passo);
    };
    animacaoRef.current = requestAnimationFrame(passo);
  }

  const cliente = clientes.find((item) => item.id === aberto);
  const projetoDo = (id: string) => projetos.find((item) => item.clienteIds.includes(id));
  const estados = new Set(clientes.map((item) => item.uf));
  const mostraEquipe = filtro === 'todos' || filtro === 'equipe';
  const mostraCliente = (item: ClienteDTO) => filtro === 'todos' || filtro === 'clientes' || filtro === projetoDo(item.id)?.id;
  const projetosAtivos = projetos.filter((item) => STATUS_ATIVO.has(item.status));
  const tarefasSemana = tarefas.filter((item) => {
    if (!item.prazo) return false;
    const dias = (new Date(item.prazo).getTime() - Date.now()) / 86400000;
    return dias <= 7 && (dias >= 0 || item.atrasada);
  });

  const marcadores = useMemo<Marcador[]>(() => {
    const lista: Marcador[] = [];
    if (mostraEquipe) {
      for (const pessoa of pessoas) {
        const ponto = pontoPessoa(pessoa);
        if (ponto) lista.push({ id: `p-${pessoa.id}`, x: ponto.x, y: ponto.y, dx: 0, dy: 0, cor: '#00ff66', nome: pessoa.nome.split(' ')[0], tipo: 'equipe' });
      }
    }
    for (const item of clientes.filter(mostraCliente)) {
      const ponto = projetar(item.latitude, item.longitude);
      lista.push({ id: `c-${item.id}`, x: ponto.x, y: ponto.y, dx: 0, dy: 0, cor: projetoDo(item.id)?.cor ?? '#8ba3b8', nome: item.nome, tipo: 'cliente', alvo: item.id });
    }
    return espalharColididos(lista);
  }, [pessoas, clientes, projetos, filtro]);

  // Nomes de cliente so aparecem com o mapa aproximado — perto demais vira sopa de letras.
  const rotulos = useMemo(() => montarRotulos(marcadores, vista, vista.k >= 1.8), [marcadores, vista]);

  const cardsPermitidos = useMemo(() => {
    const permitido: Record<string, boolean> = {
      semana: true, equipe: true, tarefas: true, noticias: true,
      clientes: pode(usuario, 'clientes', 'so_frentes'),
      projetosAtivos: pode(usuario, 'projetos', 'so_frentes'),
      decisoes: pode(usuario, 'socios', 'ler'),
      objetivos: pode(usuario, 'socios', 'ler'),
    };
    return CARDS_PADRAO.filter((id) => permitido[id]);
  }, [usuario]);

  const ordemFinal = [
    ...layout.ordem.filter((id) => cardsPermitidos.includes(id)),
    ...cardsPermitidos.filter((id) => !layout.ordem.includes(id)),
  ];

  function moverCard(id: string, direcao: -1 | 1) {
    const atual = ordemFinal.indexOf(id);
    const alvo = atual + direcao;
    if (alvo < 0 || alvo >= ordemFinal.length) return;
    const nova = [...ordemFinal];
    [nova[atual], nova[alvo]] = [nova[alvo], nova[atual]];
    setLayout({ ...layout, ordem: nova });
  }
  function alternarOculto(id: string) {
    setLayout({ ...layout, ordem: ordemFinal, ocultos: layout.ocultos.includes(id) ? layout.ocultos.filter((item) => item !== id) : [...layout.ocultos, id] });
  }
  function alternarMinimizado(id: string) {
    setLayout({ ...layout, minimizados: layout.minimizados.includes(id) ? layout.minimizados.filter((item) => item !== id) : [...layout.minimizados, id] });
  }

  async function criarDecisao() {
    if (tituloDecisao.trim().length < 3) return;
    await api('/decisoes', { method: 'POST', body: JSON.stringify({ titulo: tituloDecisao }) });
    setTituloDecisao('');
    await carregar();
  }
  async function criarObjetivo() {
    if (tituloObjetivo.trim().length < 3) return;
    const periodo = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`;
    await api('/objetivos', { method: 'POST', body: JSON.stringify({ titulo: tituloObjetivo, progresso: 0, periodo }) });
    setTituloObjetivo('');
    await carregar();
  }

  const cardProps = (id: string) => ({
    id, editando: editandoLayout, layout, onMover: moverCard, onMinimizar: alternarMinimizado, onOcultar: alternarOculto,
    primeiro: ordemFinal.indexOf(id) === 0, ultimo: ordemFinal.indexOf(id) === ordemFinal.length - 1,
  });

  const conteudoCard: Record<string, React.ReactNode> = {
    semana: (
      <>
        <p className="aviso">{tarefasSemana.length} tarefa(s) nos próximos 7 dias.</p>
        {tarefasSemana.slice(0, 4).map((tarefa) => (
          <div className="tarefa-mini" key={tarefa.id}><span>{tarefa.titulo}</span><small>{quando(tarefa.prazo, tarefa.atrasada)}</small></div>
        ))}
      </>
    ),
    equipe: (
      <>
        {pessoas.length === 0 && <p className="aviso">Ninguém com acesso ainda.</p>}
        {pessoas.map((pessoa) => (
          <div className="pessoa" key={pessoa.id}>
            <span><i style={{ color: '#00ff66' }}>●</i> {pessoa.nome.split(' ')[0]}</span>
            <small>{pessoa.cidade ? `${pessoa.cidade} · ${pessoa.uf}` : 'cidade a definir'}</small>
          </div>
        ))}
      </>
    ),
    clientes: (
      <>
        {clientes.length === 0 && <p className="aviso">Nenhum cliente no mapa. <Link href="/clientes">Adicionar</Link></p>}
        {projetos.map((projeto) => (
          <div className="cliente" key={projeto.id}>
            <span style={{ color: projeto.cor }}>● {projeto.nome}</span>
            <b>{clientes.filter((item) => projeto.clienteIds.includes(item.id)).length}</b>
          </div>
        ))}
      </>
    ),
    projetosAtivos: (
      <>
        {projetosAtivos.length === 0 && <p className="aviso">Nenhum projeto ativo.</p>}
        {projetosAtivos.map((projeto) => (
          <div className="cliente" key={projeto.id}>
            <span style={{ color: projeto.cor }}>● {projeto.nome}</span>
            <small>{projeto.progresso}%</small>
          </div>
        ))}
      </>
    ),
    noticias: (
      <>
        {noticias.length === 0 && <p className="aviso">Nenhuma notícia publicada.</p>}
        {noticias.map((noticia) => (
          <div className="decisao" key={noticia.slug}>
            <span>{noticia.titulo}</span>
            <small>{noticia.publicadaEm ? new Date(noticia.publicadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}</small>
          </div>
        ))}
      </>
    ),
    tarefas: (
      <>
        {tarefas.slice(0, 4).map((tarefa) => (
          <div className="tarefa-mini" key={tarefa.id}><span>{tarefa.titulo}</span><small>{quando(tarefa.prazo, tarefa.atrasada)}</small></div>
        ))}
        {tarefas.length === 0 && <p className="aviso">Nenhuma tarefa atribuída a você.</p>}
      </>
    ),
    decisoes: (
      <>
        {decisoes.length === 0 && <p className="aviso">Nenhuma decisão registrada.</p>}
        {decisoes.slice(0, 4).map((item) => (
          <div className="decisao" key={item.id}>
            <span>✓ {item.titulo}</span>
            <small>{new Date(item.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small>
          </div>
        ))}
        {pode(usuario, 'socios', 'editar') && (
          <form className="nova" onSubmit={(e) => { e.preventDefault(); void criarDecisao(); }}>
            <input className="campo" placeholder="Nova decisão" value={tituloDecisao} onChange={(e) => setTituloDecisao(e.target.value)} />
          </form>
        )}
      </>
    ),
    objetivos: (
      <>
        {objetivos.length === 0 && <p className="aviso">Nenhum objetivo neste período.</p>}
        {objetivos.map((item) => (
          <div key={item.id}>
            <div className="decisao"><span>{item.titulo}</span><small>{item.progresso}%</small></div>
            <div className="barra"><i style={{ width: `${item.progresso}%` }} /></div>
          </div>
        ))}
        {pode(usuario, 'socios', 'editar') && (
          <form className="nova" onSubmit={(e) => { e.preventDefault(); void criarObjetivo(); }}>
            <input className="campo" placeholder="Novo objetivo" value={tituloObjetivo} onChange={(e) => setTituloObjetivo(e.target.value)} />
          </form>
        )}
      </>
    ),
  };

  return (
    <section className="radar-tela">
      <div className="mapa-livre">
        <svg ref={svgRef} viewBox="0 0 640 640" role="img" aria-label="Mapa do Brasil com a equipe e os clientes">
          <g ref={grupoRef}>
            {ESTADOS.map((estado) => <path key={estado.sigla} className="estado" d={estado.d} />)}
            {marcadores.map((marcador, indice) => (
              <g
                key={marcador.id}
                className={`ponto ponto-${marcador.tipo}`}
                style={{ color: marcador.cor, '--atraso': `${(indice % 6) * 0.34}s` } as React.CSSProperties}
                transform={`translate(${marcador.x} ${marcador.y}) scale(${1 / vista.k})`}
                onClick={marcador.alvo ? () => setAberto(marcador.alvo!) : undefined}
              >
                <circle className="anel" cx={marcador.dx} cy={marcador.dy} r="6" />
                <circle className="nucleo" cx={marcador.dx} cy={marcador.dy} r="1.9" />
                <circle className="alvo" cx={marcador.dx} cy={marcador.dy} r="9" />
              </g>
            ))}
          </g>
          <g className="camada-rotulos" aria-hidden="true">
            {rotulos.map((rotulo) => (
              <g key={rotulo.id} className={`rotulo-grupo rotulo-${rotulo.tipo}`} style={{ color: rotulo.cor }}>
                {Math.abs(rotulo.desvio) > 6 && (
                  <line
                    className="conector"
                    x1={rotulo.sx}
                    y1={rotulo.sy}
                    x2={rotulo.esquerda ? rotulo.rx + rotulo.largura - 4 : rotulo.rx - 3}
                    y2={rotulo.ry - 3.4}
                  />
                )}
                <text className="rotulo" x={rotulo.rx} y={rotulo.ry}>{rotulo.nome}</text>
              </g>
            ))}
          </g>
        </svg>
        {cliente && (
          <article className="popup solto">
            <header>
              <span style={{ color: projetoDo(cliente.id)?.cor ?? '#b07cff' }}>{projetoDo(cliente.id)?.nome ?? 'Cliente'}</span>
              <button className="fechar" type="button" onClick={() => setAberto(null)} aria-label="Fechar">×</button>
            </header>
            <h3>{cliente.nome}</h3>
            <p>{cliente.cidade} · {cliente.uf}</p>
            <dl>
              <dt>Status</dt><dd>{cliente.status}</dd>
              <dt>Último contato</dt><dd>{cliente.ultimoContato ? new Date(cliente.ultimoContato).toLocaleDateString('pt-BR') : '—'}</dd>
              <dt>Notas</dt><dd>{cliente.observacoes || '—'}</dd>
            </dl>
            <Link className="btn" href="/clientes">Abrir cliente →</Link>
          </article>
        )}
        <div className="zoom-controles">
          <button type="button" aria-label="Aproximar" onClick={() => aplicarZoom(1.4)}>+</button>
          <button type="button" aria-label="Afastar" onClick={() => aplicarZoom(1 / 1.4)}>−</button>
          <button type="button" aria-label="Recentralizar" onClick={() => aplicarZoom(null)}>⌂</button>
        </div>
      </div>
      <div className="flutua flutua-topo">
        <div className="topo-cabecalho">
          <div>
            <p className="kicker">Início · equipe e clientes no Brasil</p>
            <h1>Radar SPL</h1>
          </div>
          <button className="btn fantasma" type="button" onClick={() => alternarMinimizado('topo')}>{layout.minimizados.includes('topo') ? 'Expandir' : 'Minimizar'}</button>
        </div>
        {!layout.minimizados.includes('topo') && (
          <>
            <div className="stats">
              <div className="stat"><b>{clientes.length}</b><span>clientes</span></div>
              <div className="stat"><b>{estados.size}</b><span>estados</span></div>
              <div className="stat"><b>{pessoas.length}</b><span>pessoas na equipe</span></div>
              <div className="stat"><b>{tarefas.filter((t) => t.atrasada).length}</b><span>pendências</span></div>
            </div>
            <div className="linha">
              {[['todos', 'Todos'], ['equipe', 'Equipe'], ['clientes', 'Clientes']].map(([id, nome]) => (
                <button key={id} className="btn fantasma" type="button" onClick={() => setFiltro(id)} style={{ borderColor: filtro === id ? '#00ff66' : undefined }}>{nome}</button>
              ))}
              {projetos.map((projeto) => (
                <button key={projeto.id} className="btn fantasma" type="button" onClick={() => setFiltro(projeto.id)} style={{ borderColor: filtro === projeto.id ? projeto.cor : undefined }}>{projeto.nome}</button>
              ))}
              <button className="btn fantasma" type="button" onClick={() => setEditandoLayout((v) => !v)} style={{ marginLeft: 'auto' }}>{editandoLayout ? 'Pronto' : 'Editar layout'}</button>
            </div>
          </>
        )}
      </div>
      {!layout.sidebarRecolhida ? (
        <aside className="flutua-dir">
          <button className="btn fantasma" type="button" onClick={() => setLayout({ ...layout, sidebarRecolhida: true })}>Recolher lateral »</button>
          {ordemFinal.map((id) => (
            <CardPainel key={id} {...cardProps(id)}>{conteudoCard[id]}</CardPainel>
          ))}
        </aside>
      ) : (
        <button className="sidebar-reabrir" type="button" onClick={() => setLayout({ ...layout, sidebarRecolhida: false })}>« Mostrar painéis</button>
      )}
    </section>
  );
}
