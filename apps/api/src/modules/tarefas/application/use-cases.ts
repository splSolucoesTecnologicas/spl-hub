import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import { paginar } from '../../../shared/application/paginar.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import type { Usuario } from '../../acesso/domain/usuario.js';
import { Tarefa, type Coluna, type Produto } from '../domain/tarefa.js';
import type { GitHubProjetos, TarefaRepository } from './ports/tarefa-repository.js';

export class TarefaNaoEncontrada extends ErroDeDominio {
  constructor(id: string) { super('nao_encontrada', `Tarefa ${id} não encontrada`); }
}

export function criarCasosDeUsoTarefas(deps: { repo: TarefaRepository; github: GitHubProjetos; relogio: Relogio; ids: GeradorId }) {
  const { repo, github, relogio, ids } = deps;
  return {
    async criar(ator: Usuario, input: {
      titulo: string; coluna?: Coluna; produto?: Produto; responsavelId?: string | null; observadorIds?: string[];
      referencia?: string | null; pullRequest?: string | null; prazo?: Date | null; exemplo?: boolean;
    }) {
      ator.exigir('tarefas', 'editar');
      const tarefa = Tarefa.criar({ id: ids.novo(), agora: relogio.agora(), ...input, responsavelId: input.responsavelId === undefined ? ator.id : input.responsavelId });
      await repo.salvar(tarefa);
      return tarefa;
    },
    async atualizar(ator: Usuario, id: string, input: Parameters<Tarefa['atualizar']>[0]) {
      ator.exigir('tarefas', 'editar');
      const tarefa = await repo.buscarPorId(id);
      if (!tarefa) throw new TarefaNaoEncontrada(id);
      tarefa.atualizar(input, relogio.agora());
      await repo.salvar(tarefa);
      return tarefa;
    },
    async remover(ator: Usuario, id: string) {
      ator.exigir('tarefas', 'editar');
      const tarefa = await repo.buscarPorId(id);
      if (!tarefa) throw new TarefaNaoEncontrada(id);
      await repo.remover(id);
    },
    async listar(ator: Usuario, params: { limite?: number; cursor?: string; coluna?: Coluna; responsavelId?: string; produto?: Produto; filtro?: 'minhas' | 'de_olho' | 'todas' }) {
      ator.exigir('tarefas', 'ler');
      const limite = Math.min(params.limite ?? 100, 100);
      const filtro = params.filtro ?? 'todas';
      if (filtro !== 'todas') {
        const todas = (await repo.listarTodas()).filter((tarefa) => tarefa.visivelPara(ator.id, filtro) && (!params.coluna || tarefa.coluna === params.coluna));
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
  };
}

export type CasosDeUsoTarefas = ReturnType<typeof criarCasosDeUsoTarefas>;
