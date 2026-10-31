import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import { paginar } from '../../../shared/application/paginar.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import type { Usuario } from '../../acesso/domain/usuario.js';
import { Tarefa, type Coluna, type Produto } from '../domain/tarefa.js';
import type { GitHubProjetos, TarefaRepository } from './ports/tarefa-repository.js';
import type { ProjetoRepository } from '../../operacao/application/ports.js';

export class TarefaNaoEncontrada extends ErroDeDominio {
  constructor(id: string) { super('nao_encontrada', `Tarefa ${id} não encontrada`); }
}

export function criarCasosDeUsoTarefas(deps: { repo: TarefaRepository; github: GitHubProjetos; projetos: ProjetoRepository; relogio: Relogio; ids: GeradorId }) {
  const { repo, github, projetos, relogio, ids } = deps;

  async function sincronizarComGithubSeVinculado(tarefa: Tarefa) {
    if (!tarefa.projetoId) return;
    const projeto = await projetos.buscarPorId(tarefa.projetoId);
    if (!projeto?.repositorio || projeto.githubProjectNumero == null || !projeto.githubColunaMap) return;
    const [owner, repoNome] = projeto.repositorio.split('/');
    if (!owner || !repoNome) return;
    const opcaoStatusId = projeto.githubColunaMap[tarefa.coluna];
    if (!opcaoStatusId) return;
    const issue = await github.criarOuAtualizarIssue({
      owner, repo: repoNome, issueNumero: tarefa.githubIssueNumero, titulo: tarefa.titulo, estado: tarefa.coluna === 'feito' ? 'closed' : 'open',
    });
    const item = await github.definirStatusNoProjeto({
      owner, repo: repoNome, numeroProjeto: projeto.githubProjectNumero, issueNodeId: issue.nodeId, itemNodeId: tarefa.githubItemNodeId, opcaoStatusId,
    });
    tarefa.vincularGithub(issue.issueNumero, issue.nodeId, item.itemNodeId);
    await repo.salvar(tarefa);
  }

  return {
    async criar(ator: Usuario, input: {
      titulo: string; coluna?: Coluna; produto?: Produto; responsavelId?: string | null; observadorIds?: string[];
      projetoId?: string | null; referencia?: string | null; pullRequest?: string | null; prazo?: Date | null; exemplo?: boolean;
    }) {
      ator.exigir('tarefas', 'editar');
      const tarefa = Tarefa.criar({ id: ids.novo(), agora: relogio.agora(), ...input, responsavelId: input.responsavelId === undefined ? ator.id : input.responsavelId });
      await repo.salvar(tarefa);
      try { await sincronizarComGithubSeVinculado(tarefa); } catch (erro) { console.error('Falha ao sincronizar com GitHub:', erro); }
      return tarefa;
    },
    async atualizar(ator: Usuario, id: string, input: Parameters<Tarefa['atualizar']>[0]) {
      ator.exigir('tarefas', 'editar');
      const tarefa = await repo.buscarPorId(id);
      if (!tarefa) throw new TarefaNaoEncontrada(id);
      tarefa.atualizar(input, relogio.agora());
      await repo.salvar(tarefa);
      try { await sincronizarComGithubSeVinculado(tarefa); } catch (erro) { console.error('Falha ao sincronizar com GitHub:', erro); }
      return tarefa;
    },
    async remover(ator: Usuario, id: string) {
      ator.exigir('tarefas', 'editar');
      const tarefa = await repo.buscarPorId(id);
      if (!tarefa) throw new TarefaNaoEncontrada(id);
      await repo.remover(id);
    },
    async listar(ator: Usuario, params: { limite?: number; cursor?: string; coluna?: Coluna; responsavelId?: string; produto?: Produto; projetoId?: string; filtro?: 'minhas' | 'de_olho' | 'todas' }) {
      ator.exigir('tarefas', 'ler');
      const limite = Math.min(params.limite ?? 100, 100);
      const filtro = params.filtro ?? 'todas';
      if (filtro !== 'todas' || params.projetoId) {
        const todas = (await repo.listarTodas()).filter((tarefa) => tarefa.visivelPara(ator.id, filtro) && (!params.coluna || tarefa.coluna === params.coluna) && (!params.projetoId || tarefa.projetoId === params.projetoId));
        const pagina = paginar(todas.map((tarefa) => tarefa.toJSON()), limite, params.cursor);
        return { itens: pagina.itens.map((item) => Tarefa.restaurar(item)), proximoCursor: pagina.proximoCursor };
      }
      return repo.listar({ limite, cursor: params.cursor, coluna: params.coluna, responsavelId: params.responsavelId, produto: params.produto });
    },
    async sincronizar(ator: Usuario) {
      ator.exigir('tarefas', 'editar');
      const tarefas = await repo.listarTodas();
      const resultado = await github.sincronizar(tarefas.map((tarefa) => ({ id: tarefa.id, titulo: tarefa.titulo, coluna: tarefa.coluna, referencia: tarefa.referencia })));
      const agora = relogio.agora();
      const porId = new Map(resultado.atualizacoes.map((item) => [item.id, item.referencia]));
      for (const tarefa of tarefas) {
        tarefa.marcarSincronizada(porId.get(tarefa.id) ?? null, agora);
        await repo.salvar(tarefa);
      }
      return { modo: github.modo, sincronizadas: tarefas.length, detalhes: resultado.detalhes, em: agora };
    },
    async importarIssuesDoProjeto(ator: Usuario, projetoId: string) {
      ator.exigir('tarefas', 'editar');
      const projeto = await projetos.buscarPorId(projetoId);
      if (!projeto?.repositorio) throw new ErroDeDominio('projeto_sem_repo', 'Projeto não tem repositório do GitHub vinculado');
      const [owner, repoNome] = projeto.repositorio.split('/');
      if (!owner || !repoNome) throw new ErroDeDominio('projeto_sem_repo', 'Repositório do projeto inválido');
      const issues = await github.listarIssuesDoRepo(owner, repoNome);
      const existentes = await repo.listarTodas();
      const agora = relogio.agora();
      let importadas = 0;
      for (const issue of issues) {
        const jaExiste = existentes.some((tarefa) => tarefa.projetoId === projetoId && tarefa.githubIssueNumero === issue.numero);
        if (jaExiste) continue;
        const coluna: Coluna = issue.estado === 'closed' ? 'feito' : 'a_fazer';
        const tarefa = Tarefa.criar({ id: ids.novo(), titulo: issue.titulo, agora, coluna, projetoId, referencia: `${projeto.repositorio}#${issue.numero}` });
        tarefa.vincularGithub(issue.numero, issue.nodeId, null);
        await repo.salvar(tarefa);
        importadas++;
      }
      return { importadas, total: issues.length };
    },
  };
}

export type CasosDeUsoTarefas = ReturnType<typeof criarCasosDeUsoTarefas>;
