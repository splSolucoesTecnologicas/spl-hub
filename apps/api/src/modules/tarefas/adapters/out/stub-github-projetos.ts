import { ErroDeDominio } from '../../../../shared/domain/erro-de-dominio.js';
import type { GitHubProjetos } from '../../application/ports/tarefa-repository.js';

/**
 * Adapter real, atrás de GITHUB_ADAPTER=http.
 * A forma da chamada (token, owner, project) já está prevista; a query GraphQL do GitHub Projects ainda não é executada.
 */
export class StubGitHubProjetos implements GitHubProjetos {
  readonly modo = 'http' as const;
  constructor(private readonly cfg: { token?: string; owner?: string; project?: string }) {}

  async sincronizar(_tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]): Promise<{ atualizacoes: { id: string; referencia: string }[]; detalhes: string }> {
    if (!this.cfg.token || !this.cfg.owner || !this.cfg.project) {
      throw new ErroDeDominio('github_nao_configurado', 'Defina GITHUB_TOKEN, GITHUB_OWNER e GITHUB_PROJECT para o adapter HTTP');
    }
    throw new ErroDeDominio('github_stub', 'O adapter real do GitHub Projects está esboçado e ainda não chama a API');
  }
}
