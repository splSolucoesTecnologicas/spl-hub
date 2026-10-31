'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
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
      .scaleExtent([1, 8])
      .on('zoom', (evento) => { select(grupo).attr('transform', evento.transform.toString()); });
    selecao.call(comportamento);
    zoomRef.current = comportamento;
    return () => { selecao.on('.zoom', null); };
  }, []);

  useEffect(() => {
    if (primeiraRenderLayout.current) { primeiraRenderLayout.current = false; return; }
    const tempo = setTimeout(() => {
      void api(`/acesso/usuarios/${usuario.id}`, { method: 'PATCH', body: JSON.stringify({ layoutInicio: layout }) }).then(recarregar).catch(() => undefined);
    }, 600);
    return () => clearTimeout(tempo);
  }, [layout]);

  function aplicarZoom(fator: number | null) {
    const svg = svgRef.current;
    const comportamento = zoomRef.current;
    if (!svg || !comportamento) return;
    const selecao = select(svg);
    if (fator == null) comportamento.transform(selecao, zoomIdentity);
    else comportamento.scaleBy(selecao, fator);
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
            {mostraEquipe && (() => {
              const vistos = new Map<string, number>();
              return pessoas.map((pessoa) => {
                const ponto = pontoPessoa(pessoa);
                if (!ponto) return null;
                const chave = `${ponto.x.toFixed(1)},${ponto.y.toFixed(1)}`;
                const ordem = vistos.get(chave) ?? 0;
                vistos.set(chave, ordem + 1);
                const deslocY = ordem * 14;
                return (
                  <g key={pessoa.id} className="ponto" style={{ color: '#00ff66' }}>
                    <circle className="halo" cx={ponto.x} cy={ponto.y} r="9" />
                    <circle className="nucleo" cx={ponto.x} cy={ponto.y} r="4.5" fill="currentColor" />
                    <text className="rotulo" x={ponto.x + 8} y={ponto.y - 6 + deslocY} fill="#00ff66">{pessoa.nome.split(' ')[0]}</text>
                  </g>
                );
              });
            })()}
            {clientes.filter(mostraCliente).map((item) => {
              const ponto = projetar(item.latitude, item.longitude);
              const cor = projetoDo(item.id)?.cor ?? '#8a908c';
              return (
                <g key={item.id} className="ponto" style={{ color: cor }} onClick={() => setAberto(item.id)}>
                  <circle className="halo" cx={ponto.x} cy={ponto.y} r="8" />
                  <circle className="nucleo" cx={ponto.x} cy={ponto.y} r="4" fill="currentColor" />
                </g>
              );
            })}
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
