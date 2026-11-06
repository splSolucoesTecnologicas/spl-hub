import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import { paginar } from '../../../shared/application/paginar.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import type { Usuario } from '../../acesso/domain/usuario.js';
import { Tarefa, type Coluna, type Produto } from '../domain/tarefa.js';
import type { GitHubProjetos } from './ports/github-projetos.js';
import type { TarefaRepository } from './ports/tarefa-repository.js';
import type { ProjetoRepository } from '../../operacao/application/ports.js';
import { criarSincronizacaoGithub, type EventoGithub } from './sincronizacao-github.js';

export class TarefaNaoEncontrada extends ErroDeDominio {
  constructor(id: string) { super('nao_encontrada', `Tarefa ${id} não encontrada`); }
}

export function criarCasosDeUsoTarefas(deps: { repo: TarefaRepository; github: GitHubProjetos; projetos: ProjetoRepository; relogio: Relogio; ids: GeradorId }) {
  const { repo, relogio, ids } = deps;
  const sincronizacao = criarSincronizacaoGithub({ tarefas: repo, projetos: deps.projetos, github: deps.github, relogio, ids });

  async function enviarAoGithub(tarefa: Tarefa) {
    // A tarefa já está salva: falha no GitHub não desfaz a edição no Hub e fica para a ressincronização.
    try {
      await sincronizacao.enviar(tarefa);
    } catch (erro) {
      console.error(`Falha ao enviar a tarefa ${tarefa.id} ao GitHub:`, erro);
    }
  }

  return {
    async criar(ator: Usuario, input: {
      titulo: string; coluna?: Coluna; produto?: Produto; responsavelId?: string | null; observadorIds?: string[];
      projetoId?: string | null; referencia?: string | null; pullRequest?: string | null; prazo?: Date | null; exemplo?: boolean;
    }) {
      ator.exigir('tarefas', 'editar');
      const tarefa = Tarefa.criar({ id: ids.novo(), agora: relogio.agora(), ...input, responsavelId: input.responsavelId === undefined ? ator.id : input.responsavelId });
      await repo.salvar(tarefa);
      await enviarAoGithub(tarefa);
      return tarefa;
    },
    async atualizar(ator: Usuario, id: string, input: Parameters<Tarefa['atualizar']>[0]) {
      ator.exigir('tarefas', 'editar');
      const tarefa = await repo.buscarPorId(id);
      if (!tarefa) throw new TarefaNaoEncontrada(id);
      tarefa.atualizar(input, relogio.agora());
      await repo.salvar(tarefa);
      await enviarAoGithub(tarefa);
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
      const resultado = await sincronizacao.ressincronizar();
      return {
        modo: resultado.modo,
        sincronizadas: resultado.enviadas,
        detalhes: resultado.modo === 'desligado'
          ? 'Integração com o GitHub desligada: nada foi enviado.'
          : `${resultado.enviadas} enviada(s) ao GitHub, ${resultado.semBoard} sem board vinculado, ${resultado.falhas} com falha.`,
        em: relogio.agora(),
      };
    },
    async importarIssuesDoProjeto(ator: Usuario, projetoId: string) {
      ator.exigir('tarefas', 'editar');
      return sincronizacao.importarIssues(projetoId);
    },
    /** Sem ator: o webhook se autentica pela assinatura HMAC, verificada no adapter de entrada. */
    async aplicarEventoGithub(evento: EventoGithub) {
      await sincronizacao.aplicarEvento(evento);
    },
  };
}

export type CasosDeUsoTarefas = ReturnType<typeof criarCasosDeUsoTarefas>;
