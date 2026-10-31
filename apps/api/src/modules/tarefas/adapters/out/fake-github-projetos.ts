import type { GitHubProjetos } from '../../application/ports/tarefa-repository.js';

/** Espelha tudo em memória. Usado em dev, testes e enquanto o App não está configurado. */
export class FakeGitHubProjetos implements GitHubProjetos {
  readonly modo = 'fake' as const;
  private sequencia = 400;
  private itens = new Map<string, { opcaoStatusId: string }>();
  private issuesPreExistentes = new Map<string, { numero: number; titulo: string; estado: 'open' | 'closed'; nodeId: string }[]>();

  /** Só pra testes: simula issues que já existiam no repo antes de qualquer sincronização pelo Hub. */
  semearIssueExistente(owner: string, repo: string, issue: { numero: number; titulo: string; estado: 'open' | 'closed' }) {
    const chave = `${owner}/${repo}`;
    const lista = this.issuesPreExistentes.get(chave) ?? [];
    lista.push({ ...issue, nodeId: `fake-issue-${issue.numero}` });
    this.issuesPreExistentes.set(chave, lista);
  }

  async sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]) {
    const atualizacoes = tarefas.filter((tarefa) => !tarefa.referencia).map((tarefa) => ({ id: tarefa.id, referencia: `spl-hub#${++this.sequencia}` }));
    return { atualizacoes, detalhes: `Adapter fake: ${tarefas.length} tarefas espelhadas em memória, sem chamar a API do GitHub.` };
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

  async criarOuAtualizarIssue(input: { owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed' }) {
    const issueNumero = input.issueNumero ?? ++this.sequencia;
    return { issueNumero, nodeId: `fake-issue-${issueNumero}` };
  }

  async definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }) {
    const itemNodeId = input.itemNodeId ?? `fake-item-${input.issueNodeId}`;
    this.itens.set(itemNodeId, { opcaoStatusId: input.opcaoStatusId });
    return { itemNodeId };
  }

  async listarIssuesDoRepo(owner: string, repo: string) {
    return this.issuesPreExistentes.get(`${owner}/${repo}`) ?? [];
  }

  async status() {
    return { conectado: false, organizacao: null };
  }
}
