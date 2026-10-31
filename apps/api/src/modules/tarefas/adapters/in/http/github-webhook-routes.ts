import type { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Tarefa, type Coluna } from '../../../domain/tarefa.js';
import type { TarefaRepository } from '../../../application/ports/tarefa-repository.js';
import type { ProjetoRepository } from '../../../../operacao/application/ports.js';

export function verificarAssinatura(corpoBruto: Buffer, assinaturaHeader: string | undefined, secret: string): boolean {
  if (!assinaturaHeader?.startsWith('sha256=')) return false;
  const esperada = Buffer.from('sha256=' + createHmac('sha256', secret).update(corpoBruto).digest('hex'));
  const recebida = Buffer.from(assinaturaHeader);
  if (esperada.length !== recebida.length) return false;
  return timingSafeEqual(esperada, recebida);
}

function colunaPelaOpcao(mapa: Record<string, string> | null, opcaoStatusId: string): string | null {
  if (!mapa) return null;
  const entrada = Object.entries(mapa).find(([, id]) => id === opcaoStatusId);
  return entrada ? entrada[0] : null;
}

interface DepsWebhook {
  tarefas: TarefaRepository;
  projetos: ProjetoRepository;
  webhookSecret: string | undefined;
  relogio: { agora: () => Date };
  ids: { novo: () => string };
}

export function githubWebhookRoutes(deps: DepsWebhook) {
  return async (app: FastifyInstance) => {
    app.register(async (escopo) => {
      escopo.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
        (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
        try { done(null, JSON.parse((body as Buffer).toString('utf8'))); } catch { done(null, {}); }
      });

      escopo.post('/github/webhook', async (req, reply) => {
        const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
        const assinatura = req.headers['x-hub-signature-256'] as string | undefined;
        if (!deps.webhookSecret || !verificarAssinatura(rawBody, assinatura, deps.webhookSecret)) {
          return reply.code(401).send({ erro: 'assinatura_invalida' });
        }
        const evento = req.headers['x-github-event'] as string | undefined;
        try {
          if (evento === 'issues') await tratarEventoIssue(req.body as Record<string, unknown>, deps);
          else if (evento === 'projects_v2_item') await tratarEventoItemProjeto(req.body as Record<string, unknown>, deps);
        } catch (erro) {
          console.error('Falha ao processar webhook do GitHub:', erro);
        }
        return reply.code(200).send({ ok: true });
      });
    });
  };
}

async function tratarEventoIssue(payload: Record<string, unknown>, deps: DepsWebhook) {
  const acao = payload.action as string;
  const issue = payload.issue as { number: number; title: string; state: 'open' | 'closed'; node_id: string } | undefined;
  const repositorioFull = (payload.repository as { full_name: string } | undefined)?.full_name;
  if (!issue || !repositorioFull || !['opened', 'edited', 'closed', 'reopened'].includes(acao)) return;
  const projetos = await deps.projetos.listarTodos();
  const projeto = projetos.find((item) => item.repositorio === repositorioFull);
  if (!projeto) return;
  const todas = await deps.tarefas.listarTodas();
  const existente = todas.find((tarefa) => tarefa.projetoId === projeto.id && tarefa.githubIssueNumero === issue.number);
  const coluna: Coluna = issue.state === 'closed' ? 'feito' : existente?.coluna === 'feito' ? 'a_fazer' : (existente?.coluna ?? 'a_fazer');
  if (existente) {
    existente.atualizar({ titulo: issue.title, coluna }, deps.relogio.agora());
    existente.vincularGithub(issue.number, issue.node_id, existente.githubItemNodeId);
    await deps.tarefas.salvar(existente);
    return;
  }
  if (acao !== 'opened') return;
  const nova = Tarefa.criar({ id: deps.ids.novo(), titulo: issue.title, agora: deps.relogio.agora(), coluna, projetoId: projeto.id, referencia: `${repositorioFull}#${issue.number}` });
  nova.vincularGithub(issue.number, issue.node_id, null);
  await deps.tarefas.salvar(nova);
}

async function tratarEventoItemProjeto(payload: Record<string, unknown>, deps: DepsWebhook) {
  const acao = payload.action as string;
  if (acao !== 'edited') return;
  const changes = payload.changes as { field_value?: { field_node_id?: string; to?: { id?: string } } } | undefined;
  const opcaoStatusId = changes?.field_value?.to?.id;
  const itemNodeId = (payload.projects_v2_item as { node_id?: string } | undefined)?.node_id;
  if (!opcaoStatusId || !itemNodeId) return;
  const todas = await deps.tarefas.listarTodas();
  const tarefa = todas.find((item) => item.githubItemNodeId === itemNodeId);
  if (!tarefa || !tarefa.projetoId) return;
  const projeto = await deps.projetos.buscarPorId(tarefa.projetoId);
  const coluna = colunaPelaOpcao(projeto?.githubColunaMap ?? null, opcaoStatusId);
  if (!coluna) return;
  tarefa.atualizar({ coluna: coluna as Coluna }, deps.relogio.agora());
  await deps.tarefas.salvar(tarefa);
}
