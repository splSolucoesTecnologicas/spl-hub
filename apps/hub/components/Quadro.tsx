'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { GithubStatusDTO, TarefaDTO } from '@spl/contracts';
import { api, type Pagina } from '@/lib/api';

const COLUNAS: { id: TarefaDTO['coluna']; nome: string }[] = [
  { id: 'a_fazer', nome: 'A fazer' }, { id: 'fazendo', nome: 'Fazendo' }, { id: 'revisao', nome: 'Revisão' }, { id: 'feito', nome: 'Feito' },
];
const PRODUTO: Record<TarefaDTO['produto'], { nome: string; classe: string }> = {
  thumdra: { nome: 'Thumdra', classe: 'blue' }, corujuris: { nome: 'Corujuris', classe: 'purple' }, spl: { nome: 'SPL', classe: 'grey' },
  hub: { nome: 'Hub', classe: 'green' }, infra: { nome: 'Infra', classe: 'grey' }, sob_medida: { nome: 'Sob medida', classe: 'amber' },
};

function IconGithub() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function tempoRelativo(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function Quadro({ projetoId, embutido = false }: { projetoId?: string; embutido?: boolean }) {
  const [filtro, setFiltro] = useState<'minhas' | 'de_olho' | 'todas'>('todas');
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [github, setGithub] = useState<GithubStatusDTO | null>(null);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [editando, setEditando] = useState<TarefaDTO | null>(null);
  const [excluindo, setExcluindo] = useState<TarefaDTO | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');

  async function carregar(proximo = filtro) {
    const query = new URLSearchParams({ filtro: proximo, limite: '100' });
    if (projetoId) query.set('projetoId', projetoId);
    const pagina = await api<Pagina<TarefaDTO>>(`/tarefas?${query.toString()}`);
    setTarefas(pagina.data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, [filtro, projetoId]);
  useEffect(() => {
    if (embutido) return;
    void api<GithubStatusDTO>('/github/status').then(setGithub).catch(() => setGithub({ conectado: false, organizacao: null }));
  }, [embutido]);

  async function mover(id: string, coluna: TarefaDTO['coluna']) {
    setTarefas((lista) => lista.map((tarefa) => tarefa.id === id ? { ...tarefa, coluna } : tarefa));
    await api(`/tarefas/${id}`, { method: 'PATCH', body: JSON.stringify({ coluna }) });
  }
  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (titulo.trim().length < 3) return;
    await api('/tarefas', { method: 'POST', body: JSON.stringify({ titulo, produto: 'hub', projetoId: projetoId ?? null }) });
    setTitulo('');
    setCriando(false);
    await carregar();
  }
  async function salvarEdicao(evento: FormEvent) {
    evento.preventDefault();
    if (!editando) return;
    await api(`/tarefas/${editando.id}`, { method: 'PATCH', body: JSON.stringify({ titulo: editando.titulo }) });
    setEditando(null);
    await carregar();
  }
  async function excluir() {
    if (!excluindo) return;
    await api(`/tarefas/${excluindo.id}`, { method: 'DELETE' });
    setExcluindo(null);
    await carregar();
  }
  async function sincronizar() {
    setSincronizando(true);
    try {
      await api('/tarefas/sincronizar', { method: 'POST' });
      await carregar();
    } finally {
      setSincronizando(false);
    }
  }

  const ultimaSync = tarefas.reduce<string | null>((maior, tarefa) => (!maior || (tarefa.sincronizadaEm && tarefa.sincronizadaEm > maior) ? tarefa.sincronizadaEm : maior), null);
  const temExemplo = tarefas.some((tarefa) => tarefa.exemplo);

  return (
    <section className={embutido ? undefined : 'pagina'}>
      {!embutido && (
        <>
          <p className="kicker">Trabalho da equipe · quadro único {github?.conectado ? '· GitHub' : ''}</p>
          <div className="quadro-topo">
            <h1>Tarefas</h1>
            <div className="linha">
              {github && (
                <span className={`chip ${github.conectado ? 'green' : ''}`}>
                  {github.conectado ? 'Sincronizado com GitHub Projects' : 'GitHub não conectado'}
                </span>
              )}
              {ultimaSync && <span className="aviso">última sync {tempoRelativo(ultimaSync)} · webhook {github?.conectado ? 'ativo' : 'inativo'}</span>}
              {temExemplo && <span className="chip amber">dados de exemplo</span>}
              <button className="btn fantasma" type="button" disabled={sincronizando} onClick={() => void sincronizar()}>{sincronizando ? 'Sincronizando…' : 'Sincronizar'}</button>
              <button className="btn" type="button" onClick={() => setCriando(true)}>+ Nova tarefa</button>
            </div>
          </div>
        </>
      )}
      <div className="filtros" style={{ marginBottom: 12 }}>
        {(['minhas', 'de_olho', 'todas'] as const).map((item) => (
          <button key={item} className={filtro === item ? 'ativo' : undefined} type="button" onClick={() => setFiltro(item)}>{item === 'de_olho' ? 'De olho' : item === 'minhas' ? 'Minhas' : 'Todas'}</button>
        ))}
        {embutido && <button className="btn fantasma" type="button" onClick={() => setCriando(true)} style={{ marginLeft: 'auto' }}>+ Nova tarefa</button>}
      </div>
      {erro && <p className="erro">{erro}</p>}
      {tarefas.length === 0 && <p className="aviso">Nenhuma tarefa neste quadro.</p>}
      <div className="colunas">
        {COLUNAS.map((coluna) => {
          const itens = tarefas.filter((tarefa) => tarefa.coluna === coluna.id);
          return (
            <section key={coluna.id} className="coluna" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id) void mover(id, coluna.id); }}>
              <h2>{coluna.nome} {itens.length}</h2>
              {itens.map((tarefa) => {
                const produto = PRODUTO[tarefa.produto];
                return (
                  <article key={tarefa.id} className="cartao" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', tarefa.id)}>
                    <b>{tarefa.titulo}</b>
                    <div className="meta">
                      <span className={`chip ${produto.classe}`}>{produto.nome}</span>
                      {tarefa.referencia && (
                        /^[\w.-]+\/[\w.-]+#\d+$/.test(tarefa.referencia)
                          ? <a className="chip-github" href={`https://github.com/${tarefa.referencia.replace('#', '/issues/')}`} target="_blank" rel="noreferrer"><IconGithub />{tarefa.referencia.split('/').pop()}</a>
                          : <span className="chip-github"><IconGithub />{tarefa.referencia}</span>
                      )}
                      {tarefa.pullRequest && <span className="chip blue">PR {tarefa.pullRequest}</span>}
                      {tarefa.atrasada && tarefa.prazo && <span className="atrasada">Atrasada {new Date(tarefa.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                      {!tarefa.atrasada && tarefa.coluna === 'feito' && <span className="chip green">{new Date(tarefa.atualizadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                      <span className="cartao-acoes">
                        <button className="btn fantasma" type="button" onClick={() => setEditando(tarefa)}>Editar</button>
                        <button className="btn perigo" type="button" onClick={() => setExcluindo(tarefa)}>Excluir</button>
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      {criando && (
        <div className="modal-fundo">
          <form className="modal" onSubmit={(e) => void criar(e)}>
            <h2>Nova tarefa</h2>
            <label>Título<input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito" required minLength={3} autoFocus /></label>
            <div className="linha">
              <button className="btn" type="submit">Criar</button>
              <button className="btn fantasma" type="button" onClick={() => { setCriando(false); setTitulo(''); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
      {editando && (
        <div className="modal-fundo">
          <form className="modal" onSubmit={(e) => void salvarEdicao(e)}>
            <h2>Editar tarefa</h2>
            <label>Título<input className="campo" value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} required /></label>
            <div className="linha">
              <button className="btn" type="submit">Salvar</button>
              <button className="btn fantasma" type="button" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
      {excluindo && (
        <div className="modal-fundo">
          <div className="modal" role="alertdialog">
            <h2>Excluir tarefa</h2>
            <p>Excluir "{excluindo.titulo}"? Esta ação não desfaz.</p>
            <div className="linha">
              <button className="btn perigo" type="button" onClick={() => void excluir()}>Excluir</button>
              <button className="btn fantasma" type="button" onClick={() => setExcluindo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
