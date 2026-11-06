import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type Ambiente = Readonly<Record<string, string | undefined>>;

export type ConfiguracaoGithub =
  | { adapter: 'fake' }
  | { adapter: 'desligado'; motivo: string }
  | { adapter: 'app'; appId: string; installationId: string; chavePrivada: string };

export interface Configuracao {
  porta: number;
  persistencia: 'memory' | 'prisma';
  semearExemplo: boolean;
  corsOrigens: string[];
  github: ConfiguracaoGithub;
  githubWebhookSecret: string | null;
  thumdra: { baseUrl: string; clientId: string; clientSecret: string; scopes: string } | null;
  avisoPaginas: { token: string; repositorio: string } | null;
  adminInicial: { email: string; senha: string; nome: string } | null;
}

export interface LeituraDaConfiguracao {
  configuracao: Configuracao;
  /** Problemas que não impedem a API de subir, como a integração com o GitHub desligada. */
  avisos: string[];
}

export interface LerConfiguracaoOpcoes {
  lerArquivo?: (caminho: string) => string;
}

/** Problemas que deixariam a API rodando errado em silêncio, como persistência em memória por engano. */
export class ErroDeConfiguracao extends Error {
  constructor(readonly problemas: string[]) {
    super(`Configuração inválida:\n${problemas.map((problema) => `- ${problema}`).join('\n')}`);
    this.name = 'ErroDeConfiguracao';
  }
}

const CORS_PADRAO = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080'];
const ADAPTERS_GITHUB = ['fake', 'app', 'desligado'] as const;

const valor = (env: Ambiente, nome: string): string | null => env[nome]?.trim() || null;

/** Única leitura do ambiente da API. O resto da aplicação recebe valores já validados. */
export function lerConfiguracao(env: Ambiente, opcoes: LerConfiguracaoOpcoes = {}): LeituraDaConfiguracao {
  const lerArquivo = opcoes.lerArquivo ?? ((caminho: string) => readFileSync(caminho, 'utf8'));
  const problemas: string[] = [];
  const avisos: string[] = [];

  const porta = lerPorta(env, problemas);
  const persistencia = lerPersistencia(env, problemas);
  const semearExemplo = lerSemear(env, problemas);
  if (problemas.length) throw new ErroDeConfiguracao(problemas);

  const corsBruto = valor(env, 'CORS_ORIGINS');
  const corsOrigens = corsBruto ? corsBruto.split(',').map((origem) => origem.trim()).filter(Boolean) : CORS_PADRAO;

  return {
    configuracao: {
      porta,
      persistencia,
      semearExemplo,
      corsOrigens,
      github: lerGithub(env, persistencia, lerArquivo, avisos),
      githubWebhookSecret: valor(env, 'GITHUB_WEBHOOK_SECRET'),
      thumdra: lerThumdra(env, avisos),
      avisoPaginas: lerAvisoPaginas(env),
      adminInicial: lerAdminInicial(env, avisos),
    },
    avisos,
  };
}

/** Resumo para o log de boot, sem segredos. */
export function descreverConfiguracao(configuracao: Configuracao): string {
  const { github } = configuracao;
  const descricaoGithub = github.adapter === 'app'
    ? `app (App ${github.appId}, instalação ${github.installationId}, chave com ${github.chavePrivada.length} caracteres)`
    : github.adapter === 'desligado' ? `desligado (${github.motivo})` : 'fake';
  return [
    `porta=${configuracao.porta}`,
    `persistencia=${configuracao.persistencia}`,
    `semearExemplo=${configuracao.semearExemplo ? 'sim' : 'não'}`,
    `cors=${configuracao.corsOrigens.length} origem(ns)`,
    `github=${descricaoGithub}`,
    `webhookGithub=${configuracao.githubWebhookSecret ? 'com segredo' : 'sem segredo (rejeita tudo)'}`,
    `thumdra=${configuracao.thumdra ? 'http' : 'fake'}`,
    `avisoPaginas=${configuracao.avisoPaginas ? 'ligado' : 'desligado'}`,
    `adminInicial=${configuracao.adminInicial ? 'configurado' : 'não'}`,
  ].join(' ');
}

function lerPorta(env: Ambiente, problemas: string[]): number {
  const bruto = valor(env, 'PORT');
  if (!bruto) return 3333;
  const porta = Number(bruto);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    problemas.push(`PORT="${bruto}" não é uma porta entre 1 e 65535.`);
    return 3333;
  }
  return porta;
}

function lerPersistencia(env: Ambiente, problemas: string[]): 'memory' | 'prisma' {
  // TAREFAS_REPO é o nome antigo, herdado do template; qualquer um dos dois em "prisma" liga o banco.
  const valores = ['PERSISTENCIA', 'TAREFAS_REPO'].map((nome) => ({ nome, bruto: valor(env, nome) }));
  for (const { nome, bruto } of valores) {
    if (bruto && bruto !== 'memory' && bruto !== 'prisma') problemas.push(`${nome}="${bruto}" precisa ser memory ou prisma.`);
  }
  return valores.some(({ bruto }) => bruto === 'prisma') ? 'prisma' : 'memory';
}

function lerSemear(env: Ambiente, problemas: string[]): boolean {
  const bruto = valor(env, 'SEED_EXEMPLO');
  if (bruto === 'true') return true;
  if (bruto === 'false') return false;
  if (bruto) problemas.push(`SEED_EXEMPLO="${bruto}" precisa ser true ou false.`);
  return valor(env, 'NODE_ENV') !== 'production';
}

function lerGithub(env: Ambiente, persistencia: 'memory' | 'prisma', lerArquivo: (caminho: string) => string, avisos: string[]): ConfiguracaoGithub {
  const desligar = (motivo: string): ConfiguracaoGithub => {
    avisos.push(`Integração com o GitHub desligada: ${motivo}.`);
    return { adapter: 'desligado', motivo };
  };
  const pedido = valor(env, 'GITHUB_ADAPTER');
  if (!pedido) return persistencia === 'memory' ? { adapter: 'fake' } : desligar('GITHUB_ADAPTER vazio com persistência prisma');
  if (!ADAPTERS_GITHUB.includes(pedido as (typeof ADAPTERS_GITHUB)[number])) {
    return desligar(`GITHUB_ADAPTER="${pedido}" não é ${ADAPTERS_GITHUB.join(', ')}`);
  }
  if (pedido === 'desligado') return { adapter: 'desligado', motivo: 'GITHUB_ADAPTER=desligado' };
  if (pedido === 'fake') {
    // O fake inventa números de issue; num banco de verdade eles apontariam depois para issues reais de outras pessoas.
    return persistencia === 'memory' ? { adapter: 'fake' } : desligar('GITHUB_ADAPTER=fake não grava em persistência prisma');
  }
  const appId = valor(env, 'GITHUB_APP_ID');
  const installationId = valor(env, 'GITHUB_APP_INSTALLATION_ID');
  const chavePrivada = lerChavePrivada(env, lerArquivo, avisos);
  const faltando = [
    ...(appId ? [] : ['GITHUB_APP_ID']),
    ...(installationId ? [] : ['GITHUB_APP_INSTALLATION_ID']),
    ...(chavePrivada ? [] : ['uma chave privada válida (GITHUB_APP_PRIVATE_KEY_PATH, _BASE64 ou GITHUB_APP_PRIVATE_KEY)']),
  ];
  if (!appId || !installationId || !chavePrivada) return desligar(`GITHUB_ADAPTER=app sem ${faltando.join(', ')}`);
  return { adapter: 'app', appId, installationId, chavePrivada };
}

/** Tenta, nesta ordem: arquivo, base64 do .pem inteiro e o texto direto (com \n literal ou quebras reais). */
function lerChavePrivada(env: Ambiente, lerArquivo: (caminho: string) => string, avisos: string[]): string | null {
  const caminho = valor(env, 'GITHUB_APP_PRIVATE_KEY_PATH');
  if (caminho) {
    try {
      const pem = lerArquivo(caminho);
      if (chaveValida(pem)) return pem;
      avisos.push(`GITHUB_APP_PRIVATE_KEY_PATH (${caminho}) não contém uma chave privada válida.`);
    } catch (erro) {
      avisos.push(`GITHUB_APP_PRIVATE_KEY_PATH (${caminho}) não pôde ser lido: ${erro instanceof Error ? erro.message : String(erro)}.`);
    }
  }
  const base64 = valor(env, 'GITHUB_APP_PRIVATE_KEY_BASE64');
  if (base64) {
    const pem = Buffer.from(base64, 'base64').toString('utf8');
    if (chaveValida(pem)) return pem;
    avisos.push('GITHUB_APP_PRIVATE_KEY_BASE64 não decodifica para uma chave privada válida.');
  }
  const direta = valor(env, 'GITHUB_APP_PRIVATE_KEY');
  if (direta) {
    // Editores de variável de uma linha só: aceita \n literal no lugar das quebras.
    const pem = direta.includes('\\n') ? direta.replace(/\\n/g, '\n') : direta;
    if (chaveValida(pem)) return pem;
    avisos.push('GITHUB_APP_PRIVATE_KEY não é uma chave privada válida.');
  }
  return null;
}

function chaveValida(pem: string): boolean {
  try {
    createPrivateKey(pem);
    return true;
  } catch {
    return false;
  }
}

function lerThumdra(env: Ambiente, avisos: string[]): Configuracao['thumdra'] {
  const baseUrl = valor(env, 'THUMDRA_ADMIN_URL');
  const clientId = valor(env, 'THUMDRA_CLIENT_ID');
  const clientSecret = valor(env, 'THUMDRA_CLIENT_SECRET');
  if (baseUrl && clientId && clientSecret) return { baseUrl, clientId, clientSecret, scopes: valor(env, 'THUMDRA_SCOPES') ?? 'admin:read' };
  if (baseUrl || clientId || clientSecret) {
    avisos.push('Thumdra usa o fake: THUMDRA_ADMIN_URL, THUMDRA_CLIENT_ID e THUMDRA_CLIENT_SECRET precisam vir juntos.');
  }
  return null;
}

function lerAvisoPaginas(env: Ambiente): Configuracao['avisoPaginas'] {
  const token = valor(env, 'PAGES_DISPATCH_TOKEN');
  const repositorio = valor(env, 'PAGES_DISPATCH_REPOSITORIO');
  return token && repositorio ? { token, repositorio } : null;
}

function lerAdminInicial(env: Ambiente, avisos: string[]): Configuracao['adminInicial'] {
  const email = valor(env, 'BOOTSTRAP_ADMIN_EMAIL')?.toLowerCase() ?? null;
  const senha = env.BOOTSTRAP_ADMIN_SENHA || null;
  if (email && senha) return { email, senha, nome: valor(env, 'BOOTSTRAP_ADMIN_NOME') ?? 'Admin SPL' };
  if (email || senha) avisos.push('Admin inicial não será criado: BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_SENHA precisam vir juntos.');
  return null;
}
