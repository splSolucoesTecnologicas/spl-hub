import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { GitHubProjetos, TarefaRepository } from './modules/tarefas/application/ports/tarefa-repository.js';
import type { AvisoPaginas, NoticiaRepository } from './modules/blog/application/use-cases.js';
import type { AuditoriaRepository, DesafioRepository, Senhas, SessaoRepository, SolicitacaoRepository, Tokens, TotpPort, UsuarioRepository } from './modules/acesso/application/ports.js';
import type { Relogio, GeradorId } from './shared/application/tempo.js';
import type { ThumdraAdminClient } from './integrations/thumdra/thumdra-admin-client.js';
import { criarCasosDeUsoAcesso } from './modules/acesso/application/use-cases.js';
import { criarCasosDeUsoTarefas } from './modules/tarefas/application/use-cases.js';
import { criarCasosDeUsoBlog } from './modules/blog/application/use-cases.js';
import { acessoRoutes } from './modules/acesso/adapters/in/http/acesso-routes.js';
import { tarefasRoutes } from './modules/tarefas/adapters/in/http/tarefas-routes.js';
import { blogRoutes } from './modules/blog/adapters/in/http/blog-routes.js';
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
  avisoPaginas: AvisoPaginas;
  github: GitHubProjetos;
  thumdra: ThumdraAdminClient;
  senhas: Senhas;
  totp: TotpPort;
  tokens: Tokens;
  relogio: Relogio;
  ids: GeradorId;
}

export function buildApp(deps: Dependencias) {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  const origens = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080').split(',').map((origem) => origem.trim()).filter(Boolean);
  app.register(cors, { origin: origens, allowedHeaders: ['content-type', 'authorization', 'idempotency-key'] });
  app.get('/health', async () => ({ ok: true, servico: 'spl-api' }));

  const acesso = criarCasosDeUsoAcesso(deps);
  const tarefas = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, relogio: deps.relogio, ids: deps.ids });
  const blog = criarCasosDeUsoBlog({ repo: deps.noticias, relogio: deps.relogio, ids: deps.ids, aviso: deps.avisoPaginas });
  app.register(acessoRoutes(acesso));
  app.register(tarefasRoutes(tarefas, acesso, () => deps.relogio.agora()));
  app.register(blogRoutes(blog, acesso));
  app.register(thumdraRoutes(deps.thumdra, acesso));
  return app;
}
