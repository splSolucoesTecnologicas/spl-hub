'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { TarefaDTO } from '@spl/contracts';
import { api, type Pagina } from '@/lib/api';

const COLUNAS: { id: TarefaDTO['coluna']; nome: string }[] = [
  { id: 'a_fazer', nome: 'A fazer' }, { id: 'fazendo', nome: 'Fazendo' }, { id: 'revisao', nome: 'Revisão' }, { id: 'feito', nome: 'Feito' },
];
const COR: Record<TarefaDTO['produto'], string> = {
  thumdra: '#4c8dff', corujuris: '#b07cff', spl: '#8a908c', hub: '#00ff66', infra: '#8a908c', sob_medida: '#f0a202',
};

export function Quadro() {
  const [filtro, setFiltro] = useState<'minhas' | 'de_olho' | 'todas'>('todas');
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [titulo, setTitulo] = useState('');
  const [sync, setSync] = useState('última sync de exemplo · adapter fake');
  const [erro, setErro] = useState('');

  async function carregar(proximo = filtro) {
    const pagina = await api<Pagina<TarefaDTO>>(`/tarefas?filtro=${proximo}&limite=100`);
    setTarefas(pagina.data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, [filtro]);

  async function mover(id: string, coluna: TarefaDTO['coluna']) {
    setTarefas((lista) => lista.map((tarefa) => tarefa.id === id ? { ...tarefa, coluna } : tarefa));
    await api(`/tarefas/${id}`, { method: 'PATCH', body: JSON.stringify({ coluna }) });
  }
  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (titulo.trim().length < 3) return;
    await api('/tarefas', { method: 'POST', body: JSON.stringify({ titulo, produto: 'hub' }) });
    setTitulo('');
    await carregar();
  }
  async function sincronizar() {
    const resultado = await api<{ modo: string; detalhes: string; sincronizadas: number }>('/tarefas/sincronizar', { method: 'POST' });
    setSync(`${resultado.modo}: ${resultado.sincronizadas} tarefas. ${resultado.detalhes}`);
    await carregar();
  }

  return (
    <section className="pagina">
      <p className="kicker">Trabalho da equipe · quadro único hub ≠ GitHub</p>
      <div className="quadro-topo">
        <h1>Tarefas</h1>
        <div className="linha">
          <span className="chip green">{sync}</span>
          <span className="chip amber">dados de exemplo</span>
          <button className="btn" type="button" onClick={() => void sincronizar()}>Sincronizar</button>
        </div>
      </div>
      <div className="filtros">
        {(['minhas', 'de_olho', 'todas'] as const).map((item) => (
          <button key={item} className={filtro === item ? 'ativo' : undefined} type="button" onClick={() => setFiltro(item)}>{item === 'de_olho' ? 'De olho' : item === 'minhas' ? 'Minhas' : 'Todas'}</button>
        ))}
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="colunas">
        {COLUNAS.map((coluna) => {
          const itens = tarefas.filter((tarefa) => tarefa.coluna === coluna.id);
          return (
            <section key={coluna.id} className="coluna" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id) void mover(id, coluna.id); }}>
              <h2>{coluna.nome} {itens.length}</h2>
              {itens.map((tarefa) => (
                <article key={tarefa.id} className="cartao" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', tarefa.id)}>
                  <b>{tarefa.titulo}</b>
                  <div className="meta">
                    <span className="chip" style={{ color: COR[tarefa.produto] }}>{tarefa.produto}</span>
                    {tarefa.referencia && <span>{tarefa.referencia}</span>}
                    {tarefa.pullRequest && <span>{tarefa.pullRequest}</span>}
                    {tarefa.exemplo && <span className="chip amber">exemplo</span>}
                    {tarefa.atrasada && tarefa.prazo && <span className="atrasada">Atrasada {new Date(tarefa.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                  </div>
                </article>
              ))}
              {coluna.id === 'a_fazer' && (
                <form className="nova" onSubmit={(e) => void criar(e)}>
                  <input className="campo" placeholder="Nova tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                  <button className="btn" type="submit">+ Nova tarefa</button>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
