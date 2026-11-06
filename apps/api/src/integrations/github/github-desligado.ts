import { ErroDeDominio } from '../../shared/domain/erro-de-dominio.js';
import type { CatalogoGithub } from '../../modules/operacao/application/ports.js';
import type { GitHubProjetos } from '../../modules/tarefas/application/ports/github-projetos.js';

/** Integração desligada: o Hub segue funcionando, mas nada é lido ou escrito no GitHub. */
export class GitHubDesligado implements GitHubProjetos, CatalogoGithub {
  readonly modo = 'desligado' as const;
  constructor(private readonly motivo: string) {}

  private recusar(): never {
    throw new ErroDeDominio('github_desligado', `Integração com o GitHub desligada: ${this.motivo}`);
  }

  async listarRepositorios(): Promise<never> { return this.recusar(); }
  async listarProjetosDoRepo(): Promise<never> { return this.recusar(); }
  async listarOpcoesDeStatus(): Promise<never> { return this.recusar(); }
  async criarIssue(): Promise<never> { return this.recusar(); }
  async atualizarIssue(): Promise<never> { return this.recusar(); }
  async definirStatusNoProjeto(): Promise<never> { return this.recusar(); }
  async listarIssuesDoRepo(): Promise<never> { return this.recusar(); }

  async status() {
    return { conectado: false, organizacao: null };
  }
}
