import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import type { ProjetoRepository } from '../../operacao/application/ports.js';
import type { VinculoGithub } from '../../operacao/domain/vinculo-github.js';
import { Tarefa, type Coluna } from '../domain/tarefa.js';
import type { GitHubProjetos, IssueGithub } from './ports/github-projetos.js';
import type { TarefaRepository } from './ports/tarefa-repository.js';

export type EventoGithub =
  | {
    tipo: 'issue';
    acao: 'opened' | 'edited' | 'closed' | 'reopened';
    repositorio: string;
    numero: number;
    titulo: string;
    estado: 'open' | 'closed';
    corpo: string | null;
    /** O GitHub informa que a issue foi criada pelo App do Hub. Só então o marcador do corpo vale. */
    criadaPeloHub: boolean;
  }
  | { tipo: 'item_do_board'; itemNodeId: string; opcaoStatusId: string };

export interface ResultadoRessincronizacao {
  modo: GitHubProjetos['modo'];
  enviadas: number;
  semBoard: number;
  falhas: number;
}

export interface SincronizacaoGithubDeps {
  tarefas: TarefaRepository;
  projetos: ProjetoRepository;
  github: GitHubProjetos;
  relogio: Relogio;
  ids: GeradorId;
}

const MARCADOR = /<!-- spl-hub:tarefa:([\w-]+) -->/;

/**
 * Vai no corpo da issue que o Hub cria. O webhook `issues.opened` pode chegar antes de o número
 * da issue ser salvo na Tarefa; o marcador deixa o webhook reconhecer a própria issue.
 */
export function marcadorDaTarefa(tarefaId: string): string {
  return `<!-- spl-hub:tarefa:${tarefaId} -->`;
}

function tarefaIdDoCorpo(corpo: string | null): string | null {
  return corpo ? MARCADOR.exec(corpo)?.[1] ?? null : null;
}

function colunaPelaIssue(estado: 'open' | 'closed', atual: Coluna | null): Coluna {
  if (estado === 'closed') return 'feito';
  if (!atual || atual === 'feito') return 'a_fazer';
  return atual;
}

/**
 * Sincronização de Tarefas com o GitHub nos dois sentidos. Saída: a Tarefa vira issue e status no board.
 * Entrada: eventos do webhook atualizam a Tarefa e nunca disparam a saída, o que evita o vai e volta.
 */
export function criarSincronizacaoGithub(deps: SincronizacaoGithubDeps) {
  const { tarefas, projetos, github, relogio, ids } = deps;

  async function vinculoDe(projetoId: string | null, cache?: Map<string, VinculoGithub | null>): Promise<VinculoGithub | null> {
    if (!projetoId) return null;
    if (cache?.has(projetoId)) return cache.get(projetoId) ?? null;
    const vinculo = (await projetos.buscarPorId(projetoId))?.vinculoGithub ?? null;
    cache?.set(projetoId, vinculo);
    return vinculo;
  }

  async function enviarComVinculo(tarefa: Tarefa, vinculo: VinculoGithub | null): Promise<boolean> {
    const board = vinculo?.board;
    if (github.modo === 'desligado' || !vinculo || !board) return false;
    const { owner, repo } = vinculo;
    const estado = tarefa.coluna === 'feito' ? 'closed' : 'open';
    let issue: IssueGithub;
    if (tarefa.githubIssueNumero == null) {
      const criada = await github.criarIssue({ owner, repo, titulo: tarefa.titulo, corpo: marcadorDaTarefa(tarefa.id) });
      // Salva o número antes de mexer no board: se o passo seguinte falhar, a próxima tentativa atualiza esta issue em vez de abrir outra.
      tarefa.vincularGithub({ issueNumero: criada.issueNumero, referencia: vinculo.referencia(criada.issueNumero) });
      await tarefas.salvar(tarefa);
      issue = estado === 'closed'
        ? await github.atualizarIssue({ owner, repo, issueNumero: criada.issueNumero, titulo: tarefa.titulo, estado })
        : criada;
    } else {
      issue = await github.atualizarIssue({ owner, repo, issueNumero: tarefa.githubIssueNumero, titulo: tarefa.titulo, estado });
    }
    const item = await github.definirStatusNoProjeto({
      owner, repo, numeroProjeto: board.numero, issueNodeId: issue.nodeId, itemNodeId: tarefa.githubItemNodeId, opcaoStatusId: board.mapa[tarefa.coluna],
    });
    tarefa.vincularGithub({ issueNumero: issue.issueNumero, referencia: vinculo.referencia(issue.issueNumero), itemNodeId: item.itemNodeId });
    tarefa.marcarSincronizada(relogio.agora());
    await tarefas.salvar(tarefa);
    return true;
  }

  async function tarefaDaIssue(projetoId: string, evento: Extract<EventoGithub, { tipo: 'issue' }>): Promise<Tarefa | null> {
    // Qualquer pessoa com acesso ao repositório escreve no corpo da issue: o marcador só vale em issue criada
    // pelo App do Hub e nunca religa uma tarefa que já aponta para outra issue.
    const marcada = evento.criadaPeloHub ? tarefaIdDoCorpo(evento.corpo) : null;
    if (marcada) {
      const tarefa = await tarefas.buscarPorId(marcada);
      const livre = tarefa?.projetoId === projetoId && (tarefa.githubIssueNumero == null || tarefa.githubIssueNumero === evento.numero);
      if (tarefa && livre) return tarefa;
    }
    return tarefas.buscarPorIssue(projetoId, evento.numero);
  }

  async function aplicarIssue(evento: Extract<EventoGithub, { tipo: 'issue' }>): Promise<void> {
    const projeto = await projetos.buscarPorRepositorio(evento.repositorio);
    const vinculo = projeto?.vinculoGithub;
    if (!projeto || !vinculo) return;
    const agora = relogio.agora();
    const referencia = vinculo.referencia(evento.numero);
    const existente = await tarefaDaIssue(projeto.id, evento);
    if (existente) {
      existente.atualizar({ titulo: evento.titulo, coluna: colunaPelaIssue(evento.estado, existente.coluna) }, agora);
      existente.vincularGithub({ issueNumero: evento.numero, referencia });
      existente.marcarSincronizada(agora);
      await tarefas.salvar(existente);
      return;
    }
    if (evento.acao !== 'opened') return;
    const nova = Tarefa.criar({ id: ids.novo(), titulo: evento.titulo, agora, coluna: colunaPelaIssue(evento.estado, null), projetoId: projeto.id });
    nova.vincularGithub({ issueNumero: evento.numero, referencia });
    nova.marcarSincronizada(agora);
    await tarefas.salvar(nova);
  }

  async function aplicarItemDoBoard(evento: Extract<EventoGithub, { tipo: 'item_do_board' }>): Promise<void> {
    const tarefa = await tarefas.buscarPorItemDoBoard(evento.itemNodeId);
    if (!tarefa) return;
    const vinculo = await vinculoDe(tarefa.projetoId);
    const coluna = vinculo?.colunaDaOpcao(evento.opcaoStatusId, tarefa.coluna);
    if (!coluna || coluna === tarefa.coluna) return;
    const agora = relogio.agora();
    tarefa.atualizar({ coluna }, agora);
    tarefa.marcarSincronizada(agora);
    await tarefas.salvar(tarefa);
  }

  return {
    modo: github.modo,

    /** Envia a Tarefa já salva. Devolve false quando o Projeto não tem board mapeado ou a integração está desligada. */
    async enviar(tarefa: Tarefa): Promise<boolean> {
      return enviarComVinculo(tarefa, await vinculoDe(tarefa.projetoId));
    },

    async aplicarEvento(evento: EventoGithub): Promise<void> {
      if (evento.tipo === 'issue') await aplicarIssue(evento);
      else await aplicarItemDoBoard(evento);
    },

    async importarIssues(projetoId: string): Promise<{ importadas: number; total: number }> {
      const projeto = await projetos.buscarPorId(projetoId);
      if (!projeto) throw new ErroDeDominio('nao_encontrada', 'Projeto não encontrado');
      const vinculo = projeto.vinculoGithub;
      if (!vinculo) throw new ErroDeDominio('projeto_sem_repo', 'Projeto não tem repositório do GitHub vinculado');
      const issues = await github.listarIssuesDoRepo(vinculo.owner, vinculo.repo);
      const agora = relogio.agora();
      let importadas = 0;
      for (const issue of issues) {
        if (await tarefas.buscarPorIssue(projetoId, issue.numero)) continue;
        try {
          const tarefa = Tarefa.criar({ id: ids.novo(), titulo: issue.titulo, agora, coluna: colunaPelaIssue(issue.estado, null), projetoId });
          tarefa.vincularGithub({ issueNumero: issue.numero, referencia: vinculo.referencia(issue.numero) });
          tarefa.marcarSincronizada(agora);
          await tarefas.salvar(tarefa);
          importadas++;
        } catch (erro) {
          if (!(erro instanceof ErroDeDominio)) throw erro;
          console.error(`Issue ${vinculo.referencia(issue.numero)} não virou tarefa: ${erro.message}`);
        }
      }
      return { importadas, total: issues.length };
    },

    /** Passada manual em lote: reenvia toda Tarefa de Projeto com board, para cobrir falhas de envio ou de webhook. */
    async ressincronizar(): Promise<ResultadoRessincronizacao> {
      const cache = new Map<string, VinculoGithub | null>();
      const resultado: ResultadoRessincronizacao = { modo: github.modo, enviadas: 0, semBoard: 0, falhas: 0 };
      if (github.modo === 'desligado') return resultado;
      for (const tarefa of await tarefas.listarTodas()) {
        try {
          if (await enviarComVinculo(tarefa, await vinculoDe(tarefa.projetoId, cache))) resultado.enviadas++;
          else resultado.semBoard++;
        } catch (erro) {
          resultado.falhas++;
          console.error(`Falha ao reenviar a tarefa ${tarefa.id} ao GitHub:`, erro);
        }
      }
      return resultado;
    },
  };
}

export type SincronizacaoGithub = ReturnType<typeof criarSincronizacaoGithub>;
