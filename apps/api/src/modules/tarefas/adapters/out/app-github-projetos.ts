import type { GitHubProjetos } from '../../application/ports/tarefa-repository.js';
import { GithubAuth, GithubClienteHttp, type ConfigGithubApp } from './github-cliente.js';

export class AppGitHubProjetos implements GitHubProjetos {
  readonly modo = 'app' as const;
  private readonly cliente: GithubClienteHttp;
  constructor(private readonly cfg: ConfigGithubApp) {
    this.cliente = new GithubClienteHttp(new GithubAuth(cfg));
  }

  async sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]) {
    // Sincronização em lote fica restrita a tarefas já ligadas a um Projeto com repo configurado;
    // esse caminho genérico (sem saber o repo de cada tarefa) não cria issue nova — só reporta.
    return { atualizacoes: [], detalhes: `Adapter app: use a sincronização por Projeto (criarOuAtualizarIssue) — ${tarefas.length} tarefas não vinculadas a um repo não são tocadas aqui.` };
  }

  async listarRepositorios() {
    const dados = await this.cliente.rest<{ repositories: { name: string; owner: { login: string } }[] }>('/installation/repositories?per_page=100');
    return dados.repositories.map((repo) => ({ owner: repo.owner.login, nome: repo.name }));
  }

  async listarProjetosDoRepo(owner: string, repo: string) {
    const query = `query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ projectsV2(first:20){ nodes{ number title } } } }`;
    const dados = await this.cliente.graphql<{ repository: { projectsV2: { nodes: { number: number; title: string }[] } } }>(query, { owner, repo });
    return dados.repository.projectsV2.nodes.map((item) => ({ numero: item.number, titulo: item.title }));
  }

  async listarOpcoesDeStatus(owner: string, repo: string, numeroProjeto: number) {
    const query = `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ field(name:"Status"){ ... on ProjectV2SingleSelectField { options { id name } } } } } }`;
    const dados = await this.cliente.graphql<{ repository: { projectV2: { field: { options: { id: string; name: string }[] } } } }>(query, { owner, repo, numero: numeroProjeto });
    return dados.repository.projectV2.field.options.map((item) => ({ id: item.id, nome: item.name }));
  }

  async criarOuAtualizarIssue(input: { owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed' }) {
    if (input.issueNumero) {
      const issue = await this.cliente.rest<{ number: number; node_id: string }>(`/repos/${input.owner}/${input.repo}/issues/${input.issueNumero}`, {
        method: 'PATCH', body: JSON.stringify({ title: input.titulo, state: input.estado }),
      });
      return { issueNumero: issue.number, nodeId: issue.node_id };
    }
    const issue = await this.cliente.rest<{ number: number; node_id: string }>(`/repos/${input.owner}/${input.repo}/issues`, {
      method: 'POST', body: JSON.stringify({ title: input.titulo }),
    });
    return { issueNumero: issue.number, nodeId: issue.node_id };
  }

  async definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }) {
    let itemNodeId = input.itemNodeId;
    if (!itemNodeId) {
      const projeto = await this.cliente.graphql<{ repository: { projectV2: { id: string } } }>(
        `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ id } } }`,
        { owner: input.owner, repo: input.repo, numero: input.numeroProjeto },
      );
      const adicionado = await this.cliente.graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
        `mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){ item { id } } }`,
        { projectId: projeto.repository.projectV2.id, contentId: input.issueNodeId },
      );
      itemNodeId = adicionado.addProjectV2ItemById.item.id;
    }
    const projetoId = await this.cliente.graphql<{ repository: { projectV2: { id: string; field: { id: string } } } }>(
      `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ id field(name:"Status"){ ... on ProjectV2SingleSelectField { id } } } } }`,
      { owner: input.owner, repo: input.repo, numero: input.numeroProjeto },
    );
    await this.cliente.graphql(
      `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){ updateProjectV2ItemFieldValue(input:{projectId:$projectId,itemId:$itemId,fieldId:$fieldId,value:{singleSelectOptionId:$optionId}}){ clientMutationId } }`,
      { projectId: projetoId.repository.projectV2.id, itemId: itemNodeId, fieldId: projetoId.repository.projectV2.field.id, optionId: input.opcaoStatusId },
    );
    return { itemNodeId };
  }

  async status() {
    // "/app" só aceita o JWT do App, não o token de instalação — então usamos
    // "/installation/repositories" (aceita token de instalação) pra confirmar a conexão
    // e extrair a organização do primeiro repositório acessível.
    try {
      const dados = await this.cliente.rest<{ repositories: { owner: { login: string } }[] }>('/installation/repositories?per_page=1');
      return { conectado: true, organizacao: dados.repositories[0]?.owner.login ?? null };
    } catch {
      return { conectado: false, organizacao: null };
    }
  }
}
