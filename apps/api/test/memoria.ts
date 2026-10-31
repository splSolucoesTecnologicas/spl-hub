import { buildApp, type Dependencias } from '../src/app.js';
import { senhas, tokens, totp } from '../src/modules/acesso/adapters/out/crypto.js';
import { InMemoryAuditoriaRepository, InMemoryDesafioRepository, InMemorySessaoRepository, InMemorySolicitacaoRepository, InMemoryUsuarioRepository } from '../src/modules/acesso/adapters/out/in-memory-acesso.js';
import { InMemoryTarefaRepository } from '../src/modules/tarefas/adapters/out/in-memory-tarefa-repository.js';
import { FakeGitHubProjetos } from '../src/modules/tarefas/adapters/out/fake-github-projetos.js';
import { InMemoryNoticiaRepository } from '../src/modules/blog/adapters/out/in-memory-noticia-repository.js';
import { FakeThumdraAdminClient } from '../src/integrations/thumdra/fake-thumdra-admin-client.js';
import { criarCasosDeUsoAcesso } from '../src/modules/acesso/application/use-cases.js';
import type { AvisoPaginas } from '../src/modules/blog/application/use-cases.js';

export const AGORA = new Date('2026-10-30T15:00:00.000Z');

export function memoria(): Dependencias & { acesso: ReturnType<typeof criarCasosDeUsoAcesso> } {
  let n = 0;
  const deps: Dependencias = {
    usuarios: new InMemoryUsuarioRepository(),
    sessoes: new InMemorySessaoRepository(),
    desafios: new InMemoryDesafioRepository(),
    solicitacoes: new InMemorySolicitacaoRepository(),
    auditoria: new InMemoryAuditoriaRepository(),
    tarefas: new InMemoryTarefaRepository(),
    noticias: new InMemoryNoticiaRepository(),
    avisoPaginas: { async conteudoPublicoMudou() {} } satisfies AvisoPaginas,
    github: new FakeGitHubProjetos(),
    thumdra: new FakeThumdraAdminClient(),
    senhas, totp, tokens,
    relogio: { agora: () => AGORA },
    ids: { novo: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` },
  };
  return { ...deps, acesso: criarCasosDeUsoAcesso(deps) };
}

export async function adminLogado() {
  const deps = memoria();
  await deps.acesso.criarUsuario({ nome: 'Admin Teste', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
  const app = buildApp(deps);
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/acesso/login', payload: { email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026' } });
  return { app, deps, token: login.json().token as string };
}
