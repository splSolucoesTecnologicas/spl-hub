import type { CatalogoGithub } from '../../modules/operacao/application/ports.js';
import type { GitHubProjetos } from '../../modules/tarefas/application/ports/github-projetos.js';
import { GithubAuth, GithubClienteHttp, type ConfigGithubApp } from './github-cliente.js';

interface IssueRest { number: number; node_id: string }

export class AppGitHubProjetos implements GitHubProjetos, CatalogoGithub {
  readonly modo = 'app' as const;
  private readonly cliente: GithubClienteHttp;
  constructor(cfg: ConfigGithubApp) {
    this.cliente = new GithubClienteHttp(new GithubAuth(cfg));
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

  async criarIssue(input: { owner: string; repo: string; titulo: string; corpo: string }) {
    const issue = await this.cliente.rest<IssueRest>(`/repos/${input.owner}/${input.repo}/issues`, {
      method: 'POST', body: JSON.stringify({ title: input.titulo, body: input.corpo }),
    });
    return { issueNumero: issue.number, nodeId: issue.node_id };
  }

  async atualizarIssue(input: { owner: string; repo: string; issueNumero: number; titulo: string; estado: 'open' | 'closed' }) {
    const issue = await this.cliente.rest<IssueRest>(`/repos/${input.owner}/${input.repo}/issues/${input.issueNumero}`, {
      method: 'PATCH', body: JSON.stringify({ title: input.titulo, state: input.estado }),
    });
    return { issueNumero: issue.number, nodeId: issue.node_id };
  }

  async definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }) {
    const projeto = await this.cliente.graphql<{ repository: { projectV2: { id: string; field: { id: string } } } }>(
      `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ id field(name:"Status"){ ... on ProjectV2SingleSelectField { id } } } } }`,
      { owner: input.owner, repo: input.repo, numero: input.numeroProjeto },
    );
    const projetoId = projeto.repository.projectV2.id;
    let itemNodeId = input.itemNodeId;
    if (!itemNodeId) {
      const adicionado = await this.cliente.graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
        `mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){ item { id } } }`,
        { projectId: projetoId, contentId: input.issueNodeId },
      );
      itemNodeId = adicionado.addProjectV2ItemById.item.id;
    }
    await this.cliente.graphql(
      `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){ updateProjectV2ItemFieldValue(input:{projectId:$projectId,itemId:$itemId,fieldId:$fieldId,value:{singleSelectOptionId:$optionId}}){ clientMutationId } }`,
      { projectId: projetoId, itemId: itemNodeId, fieldId: projeto.repository.projectV2.field.id, optionId: input.opcaoStatusId },
    );
    return { itemNodeId };
  }

  async listarIssuesDoRepo(owner: string, repo: string) {
    const issues = await this.cliente.rest<{ number: number; title: string; state: 'open' | 'closed'; node_id: string; pull_request?: unknown }[]>(
      `/repos/${owner}/${repo}/issues?state=all&per_page=100`,
    );
    return issues.filter((issue) => !issue.pull_request).map((issue) => ({ numero: issue.number, titulo: issue.title, estado: issue.state, nodeId: issue.node_id }));
  }

  async status() {
    // "/app" só aceita o JWT do App, não o token de instalação; "/installation/repositories"
    // aceita o token de instalação, confirma a conexão e revela a organização.
    try {
      const dados = await this.cliente.rest<{ repositories: { owner: { login: string } }[] }>('/installation/repositories?per_page=1');
      return { conectado: true, organizacao: dados.repositories[0]?.owner.login ?? null };
    } catch (erro) {
      console.error('GitHub status(): falha ao confirmar a conexão com o App:', erro);
      return { conectado: false, organizacao: null };
    }
  }
}
