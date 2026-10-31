import type { Coluna, Produto, Tarefa } from '../../domain/tarefa.js';

export interface TarefaRepository {
  salvar(tarefa: Tarefa): Promise<void>;
  buscarPorId(id: string): Promise<Tarefa | null>;
  remover(id: string): Promise<void>;
  listar(params: { limite: number; cursor?: string; coluna?: Coluna; responsavelId?: string; produto?: Produto }): Promise<{ itens: Tarefa[]; proximoCursor: string | null }>;
  listarTodas(): Promise<Tarefa[]>;
}

export interface GitHubProjetos {
  readonly modo: 'fake' | 'app';
  sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]): Promise<{
    atualizacoes: { id: string; referencia: string }[];
    detalhes: string;
  }>;
  listarRepositorios(): Promise<{ owner: string; nome: string }[]>;
  listarProjetosDoRepo(owner: string, repo: string): Promise<{ numero: number; titulo: string }[]>;
  listarOpcoesDeStatus(owner: string, repo: string, numeroProjeto: number): Promise<{ id: string; nome: string }[]>;
  criarOuAtualizarIssue(input: {
    owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed';
  }): Promise<{ issueNumero: number; nodeId: string }>;
  definirStatusNoProjeto(input: {
    owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string;
  }): Promise<{ itemNodeId: string }>;
  status(): Promise<{ conectado: boolean; organizacao: string | null }>;
}
