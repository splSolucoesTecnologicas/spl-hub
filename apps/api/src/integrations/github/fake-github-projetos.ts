import type { CatalogoGithub } from '../../modules/operacao/application/ports.js';
import type { GitHubProjetos, IssueDoRepositorio } from '../../modules/tarefas/application/ports/github-projetos.js';

interface IssueFake extends IssueDoRepositorio { corpo: string }

/** Espelha o GitHub em memória. Usado em dev e nos testes; nunca chama a rede. */
export class FakeGitHubProjetos implements GitHubProjetos, CatalogoGithub {
  readonly modo = 'fake' as const;
  private sequencia = 400;
  private readonly issuesPorRepo = new Map<string, IssueFake[]>();
  private readonly opcaoPorItem = new Map<string, string>();

  /** Simula uma issue que já existia no repositório antes de o Hub ser vinculado. */
  semearIssueExistente(owner: string, repo: string, issue: { numero: number; titulo: string; estado: 'open' | 'closed' }) {
    this.issuesDe(owner, repo).push({ ...issue, nodeId: `fake-issue-${issue.numero}`, corpo: '' });
  }

  issues(owner: string, repo: string): readonly IssueFake[] {
    return this.issuesDe(owner, repo);
  }

  opcaoDoItem(itemNodeId: string): string | null {
    return this.opcaoPorItem.get(itemNodeId) ?? null;
  }

  async listarRepositorios() {
    return [{ owner: 'splSolucoesTecnologicas', nome: 'exemplo-fake' }];
  }

  async listarProjetosDoRepo(_owner: string, _repo: string) {
    return [{ numero: 1, titulo: 'Board fake' }];
  }

  async listarOpcoesDeStatus(_owner: string, _repo: string, _numeroProjeto: number) {
    return [
      { id: 'opt-a-fazer', nome: 'Todo' },
      { id: 'opt-fazendo', nome: 'In Progress' },
      { id: 'opt-revisao', nome: 'In Review' },
      { id: 'opt-feito', nome: 'Done' },
    ];
  }

  async criarIssue(input: { owner: string; repo: string; titulo: string; corpo: string }) {
    const numero = ++this.sequencia;
    const issue: IssueFake = { numero, titulo: input.titulo, estado: 'open', nodeId: `fake-issue-${numero}`, corpo: input.corpo };
    this.issuesDe(input.owner, input.repo).push(issue);
    return { issueNumero: numero, nodeId: issue.nodeId };
  }

  async atualizarIssue(input: { owner: string; repo: string; issueNumero: number; titulo: string; estado: 'open' | 'closed' }) {
    const lista = this.issuesDe(input.owner, input.repo);
    let issue = lista.find((item) => item.numero === input.issueNumero);
    if (!issue) {
      issue = { numero: input.issueNumero, titulo: input.titulo, estado: input.estado, nodeId: `fake-issue-${input.issueNumero}`, corpo: '' };
      lista.push(issue);
    }
    issue.titulo = input.titulo;
    issue.estado = input.estado;
    return { issueNumero: issue.numero, nodeId: issue.nodeId };
  }

  async definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }) {
    const itemNodeId = input.itemNodeId ?? `fake-item-${input.issueNodeId}`;
    this.opcaoPorItem.set(itemNodeId, input.opcaoStatusId);
    return { itemNodeId };
  }

  async listarIssuesDoRepo(owner: string, repo: string) {
    return this.issuesDe(owner, repo).map(({ numero, titulo, estado, nodeId }) => ({ numero, titulo, estado, nodeId }));
  }

  async status() {
    return { conectado: false, organizacao: null };
  }

  private issuesDe(owner: string, repo: string): IssueFake[] {
    const chave = `${owner}/${repo}`.toLowerCase();
    let lista = this.issuesPorRepo.get(chave);
    if (!lista) {
      lista = [];
      this.issuesPorRepo.set(chave, lista);
    }
    return lista;
  }
}
