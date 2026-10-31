import type { Dependencias } from '../app.js';
import { SolicitacaoAcesso } from '../modules/acesso/domain/sessao.js';
import { Usuario, permissoesPadrao, MODULOS, type Permissoes } from '../modules/acesso/domain/usuario.js';
import { Tarefa } from '../modules/tarefas/domain/tarefa.js';
import { Noticia } from '../modules/blog/domain/noticia.js';

export const SENHA_EXEMPLO = 'SplExemplo#2026';
export const TOTP_LUCAS = 'JBSWY3DPEHPK3PXP';

export const ID = {
  segatto: '11111111-1111-4111-8111-111111111111',
  sergio: '22222222-2222-4222-8222-222222222222',
  eduardo: '33333333-3333-4333-8333-333333333333',
  marco: '44444444-4444-4444-8444-444444444444',
  lucas: '55555555-5555-4555-8555-555555555555',
  gul: '66666666-6666-4666-8666-666666666666',
} as const;

function fimDoDia(base: Date, dias: number): Date {
  const data = new Date(base);
  data.setUTCDate(data.getUTCDate() + dias);
  data.setUTCHours(23, 0, 0, 0);
  return data;
}

function editarTudo(): Permissoes {
  const permissoes = permissoesPadrao('socio');
  for (const modulo of MODULOS) permissoes[modulo] = { nivel: 'editar', extraAte: null };
  return permissoes;
}

function permissoesLucas(): Permissoes {
  const permissoes = permissoesPadrao('colaborador');
  permissoes.inicio = { nivel: 'so_frentes', extraAte: null };
  permissoes.tarefas = { nivel: 'editar', extraAte: null };
  permissoes.frentes = { nivel: 'so_frentes', extraAte: null };
  permissoes.admin_thumdra = { nivel: 'ler', extraAte: '2026-12-31' };
  permissoes.drive = { nivel: 'ler', extraAte: null };
  permissoes.reunioes = { nivel: 'ler', extraAte: null };
  return permissoes;
}

export async function semearExemplo(deps: Dependencias): Promise<void> {
  const jaTem = await deps.usuarios.listar({ limite: 1 });
  if (jaTem.itens.length > 0) return;
  const agora = deps.relogio.agora();
  const senhaHash = await deps.senhas.hash(SENHA_EXEMPLO);
  const pessoas = [
    Usuario.criar({ id: ID.segatto, nome: 'Guilherme Segatto', email: 'segatto@splsolucoes.com', senhaHash, vinculo: 'socio', area: 'dev', cidade: 'Brasília', uf: 'DF', admin: true, frentes: ['Hub', 'Corujuris'], exemplo: true, permissoes: editarTudo(), criadoEm: agora }),
    Usuario.criar({ id: ID.sergio, nome: 'Sérgio Paulo Lustosa', email: 'sergio@splsolucoes.com', senhaHash, vinculo: 'socio', area: 'administracao', cidade: 'Goiânia', uf: 'GO', frentes: ['Financeiro', 'Jurídico'], exemplo: true, criadoEm: agora }),
    Usuario.criar({ id: ID.eduardo, nome: 'Eduardo', email: 'eduardo@splsolucoes.com', senhaHash, vinculo: 'socio', area: 'dev', frentes: ['Thumdra'], exemplo: true, criadoEm: agora }),
    Usuario.criar({ id: ID.marco, nome: 'Marco', email: 'marco@splsolucoes.com', senhaHash, vinculo: 'socio', area: 'administracao', frentes: ['Comercial', 'INPI'], exemplo: true, criadoEm: agora }),
    Usuario.criar({ id: ID.lucas, nome: 'Lucas', email: 'lucas@splsolucoes.com', senhaHash, vinculo: 'colaborador', area: 'dev', frentes: ['Thumdra'], exemplo: true, permissoes: permissoesLucas(), totpSegredo: TOTP_LUCAS, totpAtivo: true, criadoEm: agora }),
    Usuario.criar({ id: ID.gul, nome: 'Gul', email: 'gul@splsolucoes.com', senhaHash, vinculo: 'colaborador', area: 'marketing', frentes: ['Thumdra'], exemplo: true, criadoEm: agora }),
  ];
  for (const pessoa of pessoas) await deps.usuarios.salvar(pessoa);

  const tarefas: Array<Omit<Parameters<typeof Tarefa.criar>[0], 'agora'>> = [
    { id: 'a1000001-0000-4000-8000-000000000001', titulo: 'Contratar proxy brasileiro', coluna: 'a_fazer', produto: 'corujuris', responsavelId: ID.eduardo, referencia: 'corujuris#41', exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000002', titulo: 'Retomar marketing e redes', coluna: 'a_fazer', produto: 'spl', responsavelId: ID.gul, referencia: 'spl-site#7', exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000003', titulo: 'Colocar hub em hub.splsolucoes.com', coluna: 'a_fazer', produto: 'hub', responsavelId: ID.segatto, referencia: 'spl-hub#12', exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000004', titulo: 'Repo-modelo no GitHub da SPL', coluna: 'a_fazer', produto: 'hub', responsavelId: ID.segatto, prazo: fimDoDia(agora, 1), exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000005', titulo: 'Pauta da reunião de sócios', coluna: 'a_fazer', produto: 'spl', responsavelId: ID.segatto, prazo: fimDoDia(agora, 4), exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000006', titulo: 'Concluir testes e integração do proxy', coluna: 'fazendo', produto: 'corujuris', responsavelId: ID.eduardo, observadorIds: [ID.segatto], referencia: 'corujuris#38', prazo: new Date('2026-10-28T15:00:00.000Z'), exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000007', titulo: 'WhatsApp por código numérico', coluna: 'fazendo', produto: 'thumdra', responsavelId: ID.lucas, referencia: 'thumdra#214', exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000008', titulo: 'Migrar CI para VPS Dokploy', coluna: 'fazendo', produto: 'infra', responsavelId: ID.segatto, referencia: 'infra#3', exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000009', titulo: 'API /admin/v1 Thumdra', coluna: 'revisao', produto: 'thumdra', responsavelId: ID.segatto, referencia: 'thumdra#221', pullRequest: 'PR #223', prazo: fimDoDia(agora, 0), exemplo: true },
    { id: 'a1000001-0000-4000-8000-000000000010', titulo: 'Criação do Hub SPL', coluna: 'feito', produto: 'hub', responsavelId: ID.segatto, referencia: 'spl-hub#1', prazo: new Date('2026-10-21T15:00:00.000Z'), exemplo: true },
  ];
  for (const tarefa of tarefas) await deps.tarefas.salvar(Tarefa.criar({ ...tarefa, agora }));

  const noticias = [
    Noticia.criar({ id: 'b1000001-0000-4000-8000-000000000001', slug: 'hub-interno-arquitetura-hexagonal', titulo: 'O hub interno nasce em arquitetura hexagonal', resumo: 'O monorepo da SPL passa a reunir a landing, o hub e a API com módulos, portas e testes.', corpo: 'Esta publicação é um exemplo, marcada como dado de demonstração.\n\nO hub.splsolucoes.com passa a viver no mesmo repositório da landing. A API é um monólito modular: domínio, casos de uso e adapters. O primeiro corte cobre acesso com 2FA, o quadro de tarefas e as notícias que a landing lê.', autorNome: 'Guilherme Segatto', exemplo: true, agora, publicar: true }),
    Noticia.criar({ id: 'b1000001-0000-4000-8000-000000000002', slug: 'thumdra-crm-construido-na-spl', titulo: 'Thumdra, o CRM construído na SPL', resumo: 'Um produto do grupo, com marca própria, do pipeline ao WhatsApp.', corpo: 'Esta publicação é um exemplo, marcada como dado de demonstração.\n\nA Thumdra segue como produto da SPL: CRM, automação e operação comercial. No hub ela aparece como frente, nunca como a marca da holding.', autorNome: 'Guilherme Segatto', exemplo: true, agora, publicar: true }),
  ];
  for (const noticia of noticias) await deps.noticias.salvar(noticia);

  await deps.solicitacoes.salvar(SolicitacaoAcesso.abrir({
    id: 'c1000001-0000-4000-8000-000000000001', usuarioId: ID.lucas, modulo: 'admin_corujuris', nivel: 'ler',
    motivo: 'Integrar MCP', criadaEm: new Date('2026-10-23T15:00:00.000Z'), exemplo: true,
  }));
  await deps.auditoria.registrar({
    id: 'd1000001-0000-4000-8000-000000000001', atorId: ID.segatto, acao: 'conceder_leitura', alvo: ID.lucas,
    detalhe: 'Segatto deu leitura do Admin Thumdra a Lucas', criadaEm: new Date('2026-10-27T15:00:00.000Z'),
  });
}

export async function garantirAdminInicial(deps: Dependencias): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.BOOTSTRAP_ADMIN_SENHA;
  if (!email || !senha) return;
  if (await deps.usuarios.buscarPorEmail(email)) return;
  const usuario = Usuario.criar({
    id: deps.ids.novo(), nome: process.env.BOOTSTRAP_ADMIN_NOME?.trim() || 'Admin SPL', email, senhaHash: await deps.senhas.hash(senha),
    vinculo: 'socio', area: 'dev', admin: true, exemplo: false, criadoEm: deps.relogio.agora(),
  });
  await deps.usuarios.salvar(usuario);
}
