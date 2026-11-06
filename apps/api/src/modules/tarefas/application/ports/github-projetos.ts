export interface IssueGithub {
  issueNumero: number;
  nodeId: string;
}

export interface IssueDoRepositorio {
  numero: number;
  titulo: string;
  estado: 'open' | 'closed';
  nodeId: string;
}

/** Escrita no GitHub a partir das Tarefas: issues do repositório e status no board do Projects v2. */
export interface GitHubProjetos {
  readonly modo: 'fake' | 'app';
  criarIssue(input: { owner: string; repo: string; titulo: string; corpo: string }): Promise<IssueGithub>;
  atualizarIssue(input: { owner: string; repo: string; issueNumero: number; titulo: string; estado: 'open' | 'closed' }): Promise<IssueGithub>;
  definirStatusNoProjeto(input: {
    owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string;
  }): Promise<{ itemNodeId: string }>;
  listarIssuesDoRepo(owner: string, repo: string): Promise<IssueDoRepositorio[]>;
}
