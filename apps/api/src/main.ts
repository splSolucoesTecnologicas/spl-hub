import { randomUUID } from 'node:crypto';
import { buildApp, type Dependencias } from './app.js';
import { senhas, tokens, totp } from './modules/acesso/adapters/out/crypto.js';
import { InMemoryAuditoriaRepository, InMemoryDesafioRepository, InMemorySessaoRepository, InMemorySolicitacaoRepository, InMemoryUsuarioRepository } from './modules/acesso/adapters/out/in-memory-acesso.js';
import { InMemoryTarefaRepository } from './modules/tarefas/adapters/out/in-memory-tarefa-repository.js';
import { FakeGitHubProjetos } from './modules/tarefas/adapters/out/fake-github-projetos.js';
import { StubGitHubProjetos } from './modules/tarefas/adapters/out/stub-github-projetos.js';
import { InMemoryNoticiaRepository } from './modules/blog/adapters/out/in-memory-noticia-repository.js';
import { FakeThumdraAdminClient } from './integrations/thumdra/fake-thumdra-admin-client.js';
import { HttpThumdraAdminClient } from './integrations/thumdra/http-thumdra-admin-client.js';
import type { GitHubProjetos } from './modules/tarefas/application/ports/tarefa-repository.js';
import type { ThumdraAdminClient } from './integrations/thumdra/thumdra-admin-client.js';
import { AvisoPaginasGithub } from './modules/blog/adapters/out/aviso-paginas.js';
import { garantirAdminInicial, semearExemplo } from './seed/exemplo.js';

function githubDe(): GitHubProjetos {
  if (process.env.GITHUB_ADAPTER === 'http') {
    return new StubGitHubProjetos({ token: process.env.GITHUB_TOKEN, owner: process.env.GITHUB_OWNER, project: process.env.GITHUB_PROJECT });
  }
  return new FakeGitHubProjetos();
}

function thumdraDe(): ThumdraAdminClient {
  if (process.env.THUMDRA_ADMIN_URL && process.env.THUMDRA_CLIENT_ID && process.env.THUMDRA_CLIENT_SECRET) {
    return new HttpThumdraAdminClient({
      baseUrl: process.env.THUMDRA_ADMIN_URL, clientId: process.env.THUMDRA_CLIENT_ID,
      clientSecret: process.env.THUMDRA_CLIENT_SECRET, scopes: process.env.THUMDRA_SCOPES ?? 'admin:read',
    });
  }
  return new FakeThumdraAdminClient();
}

export async function criarDependencias(): Promise<Dependencias> {
  const comuns = {
    senhas, totp, tokens, github: githubDe(), thumdra: thumdraDe(),
    avisoPaginas: new AvisoPaginasGithub({ token: process.env.PAGES_DISPATCH_TOKEN, repositorio: process.env.PAGES_DISPATCH_REPOSITORIO }),
    relogio: { agora: () => new Date() }, ids: { novo: () => randomUUID() },
  };
  const usarPrisma = process.env.PERSISTENCIA === 'prisma' || process.env.TAREFAS_REPO === 'prisma';
  if (usarPrisma) {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaUsuarioRepository, PrismaSessaoRepository, PrismaDesafioRepository, PrismaSolicitacaoRepository, PrismaAuditoriaRepository } = await import('./modules/acesso/adapters/out/prisma-acesso.js');
    const { PrismaTarefaRepository } = await import('./modules/tarefas/adapters/out/prisma-tarefa-repository.js');
    const { PrismaNoticiaRepository } = await import('./modules/blog/adapters/out/prisma-noticia-repository.js');
    const db = new PrismaClient();
    return {
      ...comuns,
      usuarios: new PrismaUsuarioRepository(db), sessoes: new PrismaSessaoRepository(db), desafios: new PrismaDesafioRepository(db),
      solicitacoes: new PrismaSolicitacaoRepository(db), auditoria: new PrismaAuditoriaRepository(db),
      tarefas: new PrismaTarefaRepository(db), noticias: new PrismaNoticiaRepository(db),
    };
  }
  return {
    ...comuns,
    usuarios: new InMemoryUsuarioRepository(), sessoes: new InMemorySessaoRepository(), desafios: new InMemoryDesafioRepository(),
    solicitacoes: new InMemorySolicitacaoRepository(), auditoria: new InMemoryAuditoriaRepository(),
    tarefas: new InMemoryTarefaRepository(), noticias: new InMemoryNoticiaRepository(),
  };
}

const deps = await criarDependencias();
const semear = process.env.SEED_EXEMPLO === 'true' || (process.env.SEED_EXEMPLO !== 'false' && process.env.NODE_ENV !== 'production');
if (semear) await semearExemplo(deps);
await garantirAdminInicial(deps);
const app = buildApp(deps);
await app.listen({ port: Number(process.env.PORT ?? 3333), host: '0.0.0.0' });
console.log(`API SPL em :${process.env.PORT ?? 3333} (github ${deps.github.modo})`);
