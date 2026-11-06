import type { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EventoGithub } from '../../../application/sincronizacao-github.js';
import type { CasosDeUsoTarefas } from '../../../application/use-cases.js';

const ACOES_DE_ISSUE = ['opened', 'edited', 'closed', 'reopened'] as const;
type AcaoDeIssue = (typeof ACOES_DE_ISSUE)[number];
type Objeto = Record<string, unknown>;

const objeto = (valor: unknown): Objeto | null => (valor !== null && typeof valor === 'object' ? (valor as Objeto) : null);
const texto = (valor: unknown): string | null => (typeof valor === 'string' ? valor : null);
const ehAcaoDeIssue = (valor: string | null): valor is AcaoDeIssue => ACOES_DE_ISSUE.includes(valor as AcaoDeIssue);

export function verificarAssinatura(corpoBruto: Buffer, assinaturaHeader: string | undefined, secret: string): boolean {
  if (!assinaturaHeader?.startsWith('sha256=')) return false;
  const esperada = Buffer.from('sha256=' + createHmac('sha256', secret).update(corpoBruto).digest('hex'));
  const recebida = Buffer.from(assinaturaHeader);
  if (esperada.length !== recebida.length) return false;
  return timingSafeEqual(esperada, recebida);
}

/**
 * Traduz o payload do GitHub. Eventos que o Hub não acompanha, ou malformados, viram null.
 * `githubAppId` é o App do Hub: issue que ele criou vem com `performed_via_github_app.id` igual.
 */
export function eventoDoPayload(nomeDoEvento: string | undefined, payload: unknown, githubAppId: string | null): EventoGithub | null {
  const raiz = objeto(payload);
  if (!raiz) return null;
  const acao = texto(raiz.action);
  if (nomeDoEvento === 'issues') {
    const issue = objeto(raiz.issue);
    const repositorio = texto(objeto(raiz.repository)?.full_name);
    if (!issue || !repositorio || !ehAcaoDeIssue(acao)) return null;
    const titulo = texto(issue.title);
    const estado = issue.state;
    if (typeof issue.number !== 'number' || !titulo || (estado !== 'open' && estado !== 'closed')) return null;
    const appDaIssue = objeto(issue.performed_via_github_app)?.id;
    const criadaPeloHub = githubAppId != null && appDaIssue != null && String(appDaIssue) === githubAppId;
    return { tipo: 'issue', acao, repositorio, numero: issue.number, titulo, estado, corpo: texto(issue.body), criadaPeloHub };
  }
  if (nomeDoEvento === 'projects_v2_item' && acao === 'edited') {
    const opcaoStatusId = texto(objeto(objeto(objeto(raiz.changes)?.field_value)?.to)?.id);
    const itemNodeId = texto(objeto(raiz.projects_v2_item)?.node_id);
    if (!opcaoStatusId || !itemNodeId) return null;
    return { tipo: 'item_do_board', itemNodeId, opcaoStatusId };
  }
  return null;
}

interface DepsWebhook {
  tarefas: CasosDeUsoTarefas;
  webhookSecret: string | null;
  githubAppId: string | null;
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
        const evento = eventoDoPayload(req.headers['x-github-event'] as string | undefined, req.body, deps.githubAppId);
        if (evento) {
          // O GitHub espera 200 rápido; a falha fica no log e a ressincronização manual cobre o que faltar.
          try {
            await deps.tarefas.aplicarEventoGithub(evento);
          } catch (erro) {
            console.error('Falha ao processar webhook do GitHub:', erro);
          }
        }
        return reply.code(200).send({ ok: true });
      });
    });
  };
}
