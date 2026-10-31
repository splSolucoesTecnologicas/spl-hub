import { paginar } from '../../../../shared/application/paginar.js';
import { Tarefa, type Coluna, type Produto } from '../../domain/tarefa.js';
import type { TarefaRepository } from '../../application/ports/tarefa-repository.js';

export class InMemoryTarefaRepository implements TarefaRepository {
  private dados = new Map<string, ReturnType<Tarefa['toJSON']>>();
  async salvar(tarefa: Tarefa) { this.dados.set(tarefa.id, tarefa.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Tarefa.restaurar(props) : null; }
  async remover(id: string) { this.dados.delete(id); }
  async listarTodas() { return [...this.dados.values()].map((item) => Tarefa.restaurar(item)); }
  async listar({ limite, cursor, coluna, responsavelId, produto }: { limite: number; cursor?: string; coluna?: Coluna; responsavelId?: string; produto?: Produto }) {
    const filtrados = [...this.dados.values()].filter((item) =>
      (coluna ? item.coluna === coluna : true) && (responsavelId ? item.responsavelId === responsavelId : true) && (produto ? item.produto === produto : true));
    const pagina = paginar(filtrados, limite, cursor);
    return { itens: pagina.itens.map((item) => Tarefa.restaurar(item)), proximoCursor: pagina.proximoCursor };
  }
}
