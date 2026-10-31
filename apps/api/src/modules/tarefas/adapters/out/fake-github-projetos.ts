import type { GitHubProjetos } from '../../application/ports/tarefa-repository.js';

/** Espelha o quadro em memória. Usado em dev, testes e enquanto o token do GitHub não existe. */
export class FakeGitHubProjetos implements GitHubProjetos {
  readonly modo = 'fake' as const;
  private sequencia = 400;
  async sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]) {
    const atualizacoes = tarefas.filter((tarefa) => !tarefa.referencia).map((tarefa) => ({ id: tarefa.id, referencia: `spl-hub#${++this.sequencia}` }));
    return { atualizacoes, detalhes: `Adapter fake: ${tarefas.length} tarefas espelhadas em memória, sem chamar a API do GitHub.` };
  }
}
