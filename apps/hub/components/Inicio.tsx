'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { ClienteDTO, DecisaoDTO, ObjetivoDTO, ProjetoDTO, UsuarioDTO } from '@spl/contracts';
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

export function Inicio() {
  const { usuario } = useSessao();
  const svgRef = useRef<SVGSVGElement>(null);
  const grupoRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [projetos, setProjetos] = useState<ProjetoDTO[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [decisoes, setDecisoes] = useState<DecisaoDTO[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoDTO[]>([]);
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [tituloDecisao, setTituloDecisao] = useState('');
  const [tituloObjetivo, setTituloObjetivo] = useState('');

  async function carregar() {
    const [time, quadro] = await Promise.all([
      api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100').catch(() => ({ data: [], nextCursor: null })),
      api<Pagina<TarefaDTO>>('/tarefas?filtro=minhas&limite=10').catch(() => ({ data: [], nextCursor: null })),
    ]);
    setPessoas(time.data.filter((pessoa) => pessoa.ativo));
    setTarefas(quadro.data);
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

  return (
    <section className="radar-tela">
      <div className="mapa-livre">
        <svg ref={svgRef} viewBox="0 0 640 640" role="img" aria-label="Mapa do Brasil com a equipe e os clientes">
          <g ref={grupoRef}>
            {ESTADOS.map((estado) => <path key={estado.sigla} className="estado" d={estado.d} />)}
            {mostraEquipe && pessoas.map((pessoa) => {
              const ponto = pontoPessoa(pessoa);
              if (!ponto) return null;
              return (
                <g key={pessoa.id} className="ponto" style={{ color: '#00ff66' }}>
                  <circle className="halo" cx={ponto.x} cy={ponto.y} r="9" />
                  <circle className="nucleo" cx={ponto.x} cy={ponto.y} r="4.5" fill="currentColor" />
                  <text className="rotulo" x={ponto.x + 8} y={ponto.y - 6} fill="#00ff66">{pessoa.nome.split(' ')[0]}</text>
                </g>
              );
            })}
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
        <p className="kicker">Início · equipe e clientes no Brasil</p>
        <h1>Radar SPL</h1>
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
        </div>
      </div>
      <aside className="flutua-dir">
        <section className="painel">
          <h2>Equipe SPL</h2>
          {pessoas.length === 0 && <p className="aviso">Ninguém com acesso ainda.</p>}
          {pessoas.map((pessoa) => (
            <div className="pessoa" key={pessoa.id}>
              <span><i style={{ color: '#00ff66' }}>●</i> {pessoa.nome.split(' ')[0]}</span>
              <small>{pessoa.cidade ? `${pessoa.cidade} · ${pessoa.uf}` : 'cidade a definir'}</small>
            </div>
          ))}
        </section>
        <section className="painel">
          <h2>Clientes</h2>
          {clientes.length === 0 && <p className="aviso">Nenhum cliente no mapa. <Link href="/clientes">Adicionar</Link></p>}
          {projetos.map((projeto) => (
            <div className="cliente" key={projeto.id}>
              <span style={{ color: projeto.cor }}>● {projeto.nome}</span>
              <b>{clientes.filter((item) => projeto.clienteIds.includes(item.id)).length}</b>
            </div>
          ))}
        </section>
        <section className="painel">
          <h2>Minhas tarefas</h2>
          {tarefas.slice(0, 4).map((tarefa) => (
            <div className="tarefa-mini" key={tarefa.id}><span>{tarefa.titulo}</span><small>{quando(tarefa.prazo, tarefa.atrasada)}</small></div>
          ))}
          {tarefas.length === 0 && <p className="aviso">Nenhuma tarefa atribuída a você.</p>}
        </section>
        {pode(usuario, 'socios', 'ler') && (
          <section className="painel">
            <h2>Últimas decisões · sócios</h2>
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
          </section>
        )}
        {pode(usuario, 'socios', 'ler') && (
          <section className="painel">
            <h2>Objetivos do trimestre</h2>
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
          </section>
        )}
      </aside>
    </section>
  );
}
