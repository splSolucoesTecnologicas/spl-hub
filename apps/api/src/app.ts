import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { Configuracao } from './configuracao.js';
import type { TarefaRepository } from './modules/tarefas/application/ports/tarefa-repository.js';
import type { GitHubProjetos } from './modules/tarefas/application/ports/github-projetos.js';
import type { AvisoPaginas, NoticiaRepository } from './modules/blog/application/use-cases.js';
import type { CatalogoGithub, ClienteRepository, DecisaoRepository, ObjetivoRepository, ProjetoRepository } from './modules/operacao/application/ports.js';
import type { AuditoriaRepository, DesafioRepository, Senhas, SessaoRepository, SolicitacaoRepository, Tokens, TotpPort, UsuarioRepository } from './modules/acesso/application/ports.js';
import type { Relogio, GeradorId } from './shared/application/tempo.js';
import type { ThumdraAdminClient } from './integrations/thumdra/thumdra-admin-client.js';
import { criarCasosDeUsoAcesso } from './modules/acesso/application/use-cases.js';
import { criarCasosDeUsoTarefas } from './modules/tarefas/application/use-cases.js';
import { criarCasosDeUsoBlog } from './modules/blog/application/use-cases.js';
import { acessoRoutes } from './modules/acesso/adapters/in/http/acesso-routes.js';
import { tarefasRoutes } from './modules/tarefas/adapters/in/http/tarefas-routes.js';
import { githubWebhookRoutes } from './modules/tarefas/adapters/in/http/github-webhook-routes.js';
import { blogRoutes } from './modules/blog/adapters/in/http/blog-routes.js';
import { criarCasosDeUsoOperacao } from './modules/operacao/application/use-cases.js';
import { operacaoRoutes } from './modules/operacao/adapters/in/http/routes.js';
import { thumdraRoutes } from './integrations/thumdra/thumdra-routes.js';
import { errorHandler } from './shared/error-handler.js';

export interface Dependencias {
  usuarios: UsuarioRepository;
  sessoes: SessaoRepository;
  desafios: DesafioRepository;
  solicitacoes: SolicitacaoRepository;
  auditoria: AuditoriaRepository;
  tarefas: TarefaRepository;
  noticias: NoticiaRepository;
  clientes: ClienteRepository;
  projetos: ProjetoRepository;
  decisoes: DecisaoRepository;
  objetivos: ObjetivoRepository;
  avisoPaginas: AvisoPaginas;
  github: GitHubProjetos & CatalogoGithub;
  thumdra: ThumdraAdminClient;
  senhas: Senhas;
  totp: TotpPort;
  tokens: Tokens;
  relogio: Relogio;
  ids: GeradorId;
}

export type OpcoesDoApp = Pick<Configuracao, 'corsOrigens' | 'githubWebhookSecret' | 'github'>;

export function buildApp(deps: Dependencias, opcoes: OpcoesDoApp) {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.register(cors, { origin: opcoes.corsOrigens, allowedHeaders: ['content-type', 'authorization', 'idempotency-key'] });
  app.get('/health', async () => ({ ok: true, servico: 'spl-api' }));

  const acesso = criarCasosDeUsoAcesso(deps);
  const tarefas = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, projetos: deps.projetos, relogio: deps.relogio, ids: deps.ids });
  const blog = criarCasosDeUsoBlog({ repo: deps.noticias, relogio: deps.relogio, ids: deps.ids, aviso: deps.avisoPaginas });
  const operacao = criarCasosDeUsoOperacao(deps);
  app.register(acessoRoutes(acesso));
  app.register(tarefasRoutes(tarefas, acesso, () => deps.relogio.agora()));
  app.register(githubWebhookRoutes({
    tarefas, webhookSecret: opcoes.githubWebhookSecret, githubAppId: opcoes.github.adapter === 'app' ? opcoes.github.appId : null,
  }));
  app.register(blogRoutes(blog, acesso));
  app.register(operacaoRoutes(operacao, acesso));
  app.register(thumdraRoutes(deps.thumdra, acesso));
  return app;
}
