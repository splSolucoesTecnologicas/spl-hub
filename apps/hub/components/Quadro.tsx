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

export function Quadro({ projetoId, embutido = false }: { projetoId?: string; embutido?: boolean }) {
  const [filtro, setFiltro] = useState<'minhas' | 'de_olho' | 'todas'>('todas');
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [titulo, setTitulo] = useState('');
  const [editando, setEditando] = useState<TarefaDTO | null>(null);
  const [excluindo, setExcluindo] = useState<TarefaDTO | null>(null);
  const [sync, setSync] = useState('Ainda não sincronizado com o GitHub Projects');
  const [erro, setErro] = useState('');

  async function carregar(proximo = filtro) {
    const query = new URLSearchParams({ filtro: proximo, limite: '100' });
    if (projetoId) query.set('projetoId', projetoId);
    const pagina = await api<Pagina<TarefaDTO>>(`/tarefas?${query.toString()}`);
    setTarefas(pagina.data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, [filtro, projetoId]);

  async function mover(id: string, coluna: TarefaDTO['coluna']) {
    setTarefas((lista) => lista.map((tarefa) => tarefa.id === id ? { ...tarefa, coluna } : tarefa));
    await api(`/tarefas/${id}`, { method: 'PATCH', body: JSON.stringify({ coluna }) });
  }
  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (titulo.trim().length < 3) return;
    await api('/tarefas', { method: 'POST', body: JSON.stringify({ titulo, produto: 'hub', projetoId: projetoId ?? null }) });
    setTitulo('');
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
    const resultado = await api<{ modo: string; detalhes: string; sincronizadas: number }>('/tarefas/sincronizar', { method: 'POST' });
    setSync(`${resultado.modo}: ${resultado.sincronizadas} tarefas. ${resultado.detalhes}`);
    await carregar();
  }

  return (
    <section className={embutido ? undefined : 'pagina'}>
      {!embutido && (
        <>
          <p className="kicker">Trabalho da equipe · quadro único</p>
          <div className="quadro-topo">
            <h1>Tarefas</h1>
            <div className="linha">
              <span className="chip green">{sync}</span>
              <button className="btn" type="button" onClick={() => void sincronizar()}>Sincronizar</button>
            </div>
          </div>
        </>
      )}
      <div className="filtros" style={{ marginBottom: 12 }}>
        {(['minhas', 'de_olho', 'todas'] as const).map((item) => (
          <button key={item} className={filtro === item ? 'ativo' : undefined} type="button" onClick={() => setFiltro(item)}>{item === 'de_olho' ? 'De olho' : item === 'minhas' ? 'Minhas' : 'Todas'}</button>
        ))}
      </div>
      {erro && <p className="erro">{erro}</p>}
      {tarefas.length === 0 && <p className="aviso">Nenhuma tarefa neste quadro.</p>}
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
                    {tarefa.atrasada && tarefa.prazo && <span className="atrasada">Atrasada {new Date(tarefa.prazo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                    <button className="btn fantasma" type="button" onClick={() => setEditando(tarefa)}>Editar</button>
                    <button className="btn perigo" type="button" onClick={() => setExcluindo(tarefa)}>Excluir</button>
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
            <p>Excluir “{excluindo.titulo}”? Esta ação não desfaz.</p>
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
