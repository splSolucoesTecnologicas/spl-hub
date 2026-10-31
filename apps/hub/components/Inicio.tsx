'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ESTADOS } from '@/lib/brasil';
import { CLIENTES_EXEMPLO, DECISOES_EXEMPLO, OBJETIVOS_EXEMPLO, type ProdutoCliente } from '@/lib/dados-exemplo';
import { CIDADES, projetar } from '@/lib/geo';
import { api, type Pagina, type TarefaDTO, type UsuarioDTO } from '@/lib/api';

const COR: Record<ProdutoCliente | 'equipe', string> = {
  equipe: '#00ff66', thumdra: '#4c8dff', corujuris: '#b07cff', sob_medida: '#f0a202',
};

function quando(iso: string | null, atrasada: boolean) {
  if (!iso) return '';
  const data = new Date(iso);
  if (atrasada) return `Atrasada ${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  if (data.toDateString() === new Date().toDateString()) return 'hoje';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function Inicio() {
  const params = useSearchParams();
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'equipe' | ProdutoCliente>('todos');
  const [aberto, setAberto] = useState(params.get('cliente') ?? 'costa');

  useEffect(() => {
    void api<Pagina<UsuarioDTO>>('/acesso/usuarios').then((pagina) => setPessoas(pagina.data)).catch(() => setPessoas([]));
    void api<Pagina<TarefaDTO>>('/tarefas?filtro=minhas&limite=10').then((pagina) => setTarefas(pagina.data)).catch(() => setTarefas([]));
  }, []);

  const cliente = CLIENTES_EXEMPLO.find((item) => item.id === aberto);
  const estados = useMemo(() => new Set(CLIENTES_EXEMPLO.map((item) => item.uf)), []);
  const visivel = (produto: ProdutoCliente | 'equipe') => filtro === 'todos' || filtro === produto;

  return (
    <section className="pagina">
      <p className="kicker">Início · equipe e clientes no Brasil</p>
      <h1>Radar SPL</h1>
      <div className="stats">
        <div className="stat"><b>{CLIENTES_EXEMPLO.length}</b><span>clientes</span></div>
        <div className="stat"><b>{estados.size}</b><span>estados</span></div>
        <div className="stat"><b>{pessoas.length || '—'}</b><span>pessoas na equipe</span></div>
        <div className="stat"><b>{tarefas.filter((t) => t.atrasada).length}</b><span>pendências</span></div>
      </div>
      <div className="linha" style={{ marginBottom: 12 }}>
        {(['todos', 'equipe', 'thumdra', 'corujuris', 'sob_medida'] as const).map((item) => (
          <button key={item} className="btn fantasma" type="button" onClick={() => setFiltro(item)} style={{ borderColor: filtro === item && item !== 'todos' ? COR[item] : undefined }}>
            {item === 'todos' ? 'Todos' : item === 'sob_medida' ? 'Sob medida' : item[0]!.toUpperCase() + item.slice(1)}
          </button>
        ))}
        <span className="chip amber">dados de exemplo</span>
      </div>
      <div className="radar">
        <div className="mapa-caixa">
          <svg viewBox="0 0 640 640" role="img" aria-label="Mapa do Brasil com a equipe e os clientes de exemplo">
            {ESTADOS.map((estado) => <path key={estado.sigla} className="estado" d={estado.d} />)}
            {visivel('equipe') && pessoas.filter((p) => p.cidade && CIDADES[p.cidade]).map((pessoa) => {
              const ponto = projetar(CIDADES[pessoa.cidade!]!.lat, CIDADES[pessoa.cidade!]!.lon);
              return (
                <g key={pessoa.id} className="ponto" style={{ color: COR.equipe }}>
                  <circle className="halo" cx={ponto.x} cy={ponto.y} r="9" />
                  <circle cx={ponto.x} cy={ponto.y} r="4.5" fill="currentColor" />
                  <text className="rotulo" x={ponto.x + 8} y={ponto.y - 6} fill="#00ff66">{pessoa.nome.split(' ')[0]}</text>
                </g>
              );
            })}
            {CLIENTES_EXEMPLO.filter((item) => visivel(item.produto)).map((item) => {
              const cidade = CIDADES[item.cidade];
              if (!cidade) return null;
              const ponto = projetar(cidade.lat, cidade.lon);
              return (
                <g key={item.id} className="ponto" style={{ color: COR[item.produto] }} onClick={() => setAberto(item.id)}>
                  <circle className="halo" cx={ponto.x} cy={ponto.y} r="8" />
                  <circle cx={ponto.x} cy={ponto.y} r="4" fill="currentColor" />
                </g>
              );
            })}
          </svg>
          {cliente && (
            <article className="popup">
              <header><span style={{ color: COR[cliente.produto] }}>{cliente.produto === 'sob_medida' ? 'Sob medida' : cliente.produto[0]!.toUpperCase() + cliente.produto.slice(1)}</span><button className="fechar" type="button" onClick={() => setAberto('')} aria-label="Fechar">×</button></header>
              <h3>{cliente.nome}</h3>
              <p>{cliente.cidade} · {cliente.uf}</p>
              <dl>
                <dt>Contrato</dt><dd>{cliente.contrato ?? 'Exemplo'}</dd>
                <dt>Frente responsável</dt><dd>{cliente.frente ?? `${cliente.produto} · ${cliente.responsavel}`}</dd>
                <dt>Status</dt><dd style={{ color: cliente.status === 'Inadimplente' ? '#ff5d73' : '#00ff66' }}>{cliente.status}</dd>
                <dt>Último contato</dt><dd>{cliente.contato}</dd>
              </dl>
              <Link className="btn" href="/clientes">Abrir cliente →</Link>
            </article>
          )}
          <p className="nota-mapa">Limites estaduais: IBGE (GeoJSON público) · pontos de clientes são dados de exemplo</p>
        </div>
        <aside className="coluna-dir">
          <section className="painel">
            <h2>Equipe SPL</h2>
            {pessoas.map((pessoa) => (
              <div className="pessoa" key={pessoa.id}>
                <span><i style={{ color: COR.equipe }}>●</i> {pessoa.nome.split(' ')[0]}</span>
                <small>{pessoa.cidade ? `${pessoa.cidade} · ${pessoa.uf}` : 'cidade a definir'}</small>
              </div>
            ))}
          </section>
          <section className="painel">
            <h2>Clientes <span className="chip amber">dados de exemplo</span></h2>
            {(['thumdra', 'corujuris', 'sob_medida'] as const).map((produto) => (
              <div className="cliente" key={produto}><span style={{ color: COR[produto] }}>● {produto === 'sob_medida' ? 'Sob medida' : produto[0]!.toUpperCase() + produto.slice(1)}</span><b>{CLIENTES_EXEMPLO.filter((c) => c.produto === produto).length}</b></div>
            ))}
          </section>
          <section className="painel">
            <h2>Minhas tarefas <span className="chip amber">dados de exemplo</span></h2>
            {tarefas.slice(0, 4).map((tarefa) => (
              <div className="tarefa-mini" key={tarefa.id}><span>{tarefa.titulo}</span><small>{quando(tarefa.prazo, tarefa.atrasada)}</small></div>
            ))}
            {tarefas.length === 0 && <p className="aviso">Nenhuma tarefa atribuída a você.</p>}
          </section>
          <section className="painel">
            <h2>Últimas decisões · sócios <span className="chip amber">dados de exemplo</span></h2>
            {DECISOES_EXEMPLO.map((item) => <div className="decisao" key={item.titulo}><span>✓ {item.titulo}</span><small>{item.quando}</small></div>)}
          </section>
          <section className="painel">
            <h2>Objetivos Q4 2026 <span className="chip amber">dados de exemplo</span></h2>
            {OBJETIVOS_EXEMPLO.map((item) => (
              <div key={item.titulo}>
                <div className="decisao"><span>{item.titulo}</span><small>{item.valor}%</small></div>
                <div className="barra"><i style={{ width: `${item.valor}%` }} /></div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
