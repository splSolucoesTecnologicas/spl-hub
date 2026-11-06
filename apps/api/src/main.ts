import { randomUUID } from 'node:crypto';
import { buildApp, type Dependencias } from './app.js';
import { descreverConfiguracao, ErroDeConfiguracao, lerConfiguracao, type Configuracao, type LeituraDaConfiguracao } from './configuracao.js';
import { senhas, tokens, totp } from './modules/acesso/adapters/out/crypto.js';
import { InMemoryAuditoriaRepository, InMemoryDesafioRepository, InMemorySessaoRepository, InMemorySolicitacaoRepository, InMemoryUsuarioRepository } from './modules/acesso/adapters/out/in-memory-acesso.js';
import { InMemoryTarefaRepository } from './modules/tarefas/adapters/out/in-memory-tarefa-repository.js';
import { FakeGitHubProjetos } from './integrations/github/fake-github-projetos.js';
import { AppGitHubProjetos } from './integrations/github/app-github-projetos.js';
import { GitHubDesligado } from './integrations/github/github-desligado.js';
import { InMemoryNoticiaRepository } from './modules/blog/adapters/out/in-memory-noticia-repository.js';
import { FakeThumdraAdminClient } from './integrations/thumdra/fake-thumdra-admin-client.js';
import { HttpThumdraAdminClient } from './integrations/thumdra/http-thumdra-admin-client.js';
import type { ThumdraAdminClient } from './integrations/thumdra/thumdra-admin-client.js';
import { AvisoPaginasGithub } from './modules/blog/adapters/out/aviso-paginas.js';
import { InMemoryClienteRepository, InMemoryDecisaoRepository, InMemoryObjetivoRepository, InMemoryProjetoRepository } from './modules/operacao/adapters/out/memoria.js';
import { garantirAdminInicial, semearExemplo } from './seed/exemplo.js';

function githubDe(github: Configuracao['github']): Dependencias['github'] {
  if (github.adapter === 'app') return new AppGitHubProjetos({ appId: github.appId, chavePrivada: github.chavePrivada, installationId: github.installationId });
  if (github.adapter === 'desligado') return new GitHubDesligado(github.motivo);
  return new FakeGitHubProjetos();
}

function thumdraDe(thumdra: Configuracao['thumdra']): ThumdraAdminClient {
  return thumdra ? new HttpThumdraAdminClient(thumdra) : new FakeThumdraAdminClient();
}

export async function criarDependencias(configuracao: Configuracao): Promise<Dependencias> {
  const comuns = {
    senhas, totp, tokens, github: githubDe(configuracao.github), thumdra: thumdraDe(configuracao.thumdra),
    avisoPaginas: new AvisoPaginasGithub(configuracao.avisoPaginas ?? {}),
    relogio: { agora: () => new Date() }, ids: { novo: () => randomUUID() },
  };
  if (configuracao.persistencia === 'prisma') {
    const { PrismaClient } = await import('@prisma/client');
    const { PrismaUsuarioRepository, PrismaSessaoRepository, PrismaDesafioRepository, PrismaSolicitacaoRepository, PrismaAuditoriaRepository } = await import('./modules/acesso/adapters/out/prisma-acesso.js');
    const { PrismaTarefaRepository } = await import('./modules/tarefas/adapters/out/prisma-tarefa-repository.js');
    const { PrismaNoticiaRepository } = await import('./modules/blog/adapters/out/prisma-noticia-repository.js');
    const { PrismaClienteRepository, PrismaDecisaoRepository, PrismaObjetivoRepository, PrismaProjetoRepository } = await import('./modules/operacao/adapters/out/prisma.js');
    const db = new PrismaClient();
    return {
      ...comuns,
      usuarios: new PrismaUsuarioRepository(db), sessoes: new PrismaSessaoRepository(db), desafios: new PrismaDesafioRepository(db),
      solicitacoes: new PrismaSolicitacaoRepository(db), auditoria: new PrismaAuditoriaRepository(db),
      tarefas: new PrismaTarefaRepository(db), noticias: new PrismaNoticiaRepository(db),
      clientes: new PrismaClienteRepository(db), projetos: new PrismaProjetoRepository(db),
      decisoes: new PrismaDecisaoRepository(db), objetivos: new PrismaObjetivoRepository(db),
    };
  }
  return {
    ...comuns,
    usuarios: new InMemoryUsuarioRepository(), sessoes: new InMemorySessaoRepository(), desafios: new InMemoryDesafioRepository(),
    solicitacoes: new InMemorySolicitacaoRepository(), auditoria: new InMemoryAuditoriaRepository(),
    tarefas: new InMemoryTarefaRepository(), noticias: new InMemoryNoticiaRepository(),
    clientes: new InMemoryClienteRepository(), projetos: new InMemoryProjetoRepository(),
    decisoes: new InMemoryDecisaoRepository(), objetivos: new InMemoryObjetivoRepository(),
  };
}

function lerOuEncerrar(): LeituraDaConfiguracao {
  try {
    return lerConfiguracao(process.env);
  } catch (erro) {
    if (!(erro instanceof ErroDeConfiguracao)) throw erro;
    console.error(erro.message);
    process.exit(1);
  }
}

const { configuracao, avisos } = lerOuEncerrar();
console.log(`Configuração: ${descreverConfiguracao(configuracao)}`);
for (const aviso of avisos) console.warn(`Aviso de configuração: ${aviso}`);

const deps = await criarDependencias(configuracao);
if (configuracao.semearExemplo) await semearExemplo(deps);
await garantirAdminInicial(deps, configuracao.adminInicial);
const app = buildApp(deps, configuracao);
await app.listen({ port: configuracao.porta, host: '0.0.0.0' });
console.log(`API SPL em :${configuracao.porta} (github ${deps.github.modo})`);
