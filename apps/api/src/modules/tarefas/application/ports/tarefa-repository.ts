import type { Coluna, Produto, Tarefa } from '../../domain/tarefa.js';

export interface TarefaRepository {
  salvar(tarefa: Tarefa): Promise<void>;
  buscarPorId(id: string): Promise<Tarefa | null>;
  buscarPorIssue(projetoId: string, issueNumero: number): Promise<Tarefa | null>;
  buscarPorItemDoBoard(itemNodeId: string): Promise<Tarefa | null>;
  remover(id: string): Promise<void>;
  listar(params: { limite: number; cursor?: string; coluna?: Coluna; responsavelId?: string; produto?: Produto }): Promise<{ itens: Tarefa[]; proximoCursor: string | null }>;
  listarTodas(): Promise<Tarefa[]>;
}
