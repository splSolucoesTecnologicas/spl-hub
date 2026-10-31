import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

/** Paginação por cursor: { data, nextCursor } */
export const pagina = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), nextCursor: z.string().nullable() });

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
}).openapi('Problem');
export type Problem = z.infer<typeof ProblemSchema>;

export const VinculoSchema = z.enum(['socio', 'colaborador']);
export const AreaSchema = z.enum(['dev', 'marketing', 'administracao', 'comercial', 'financeiro', 'juridico', 'infra']);
export const NivelSchema = z.enum(['off', 'so_frentes', 'ler', 'editar']);
export const ModuloSchema = z.enum([
  'inicio', 'tarefas', 'frentes', 'projetos', 'clientes', 'reunioes', 'blog', 'podcast', 'drive', 'time', 'socios', 'configuracoes', 'admin_thumdra', 'admin_corujuris',
]);

export const PermissaoModuloSchema = z.object({
  nivel: NivelSchema,
  extraAte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).openapi('PermissaoModulo');

export const UsuarioSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string().email(),
  vinculo: VinculoSchema,
  area: AreaSchema,
  papeis: z.array(z.string()),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  ativo: z.boolean(),
  admin: z.boolean(),
  totpAtivo: z.boolean(),
  permissoes: z.record(ModuloSchema, PermissaoModuloSchema),
  frentes: z.array(z.string()),
  exemplo: z.boolean(),
  ultimoAcesso: z.string().datetime().nullable(),
}).openapi('Usuario');
export type UsuarioDTO = z.infer<typeof UsuarioSchema>;
export type Nivel = z.infer<typeof NivelSchema>;
export type Permissoes = UsuarioDTO['permissoes'];

export const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8).max(200),
}).openapi('Login');

export const LoginRespostaSchema = z.object({
  requer2fa: z.boolean(),
  desafio: z.string().uuid().optional(),
  token: z.string().optional(),
  usuario: UsuarioSchema.optional(),
}).openapi('LoginResposta');

export const TotpSchema = z.object({
  desafio: z.string().uuid(),
  codigo: z.string().regex(/^\d{6}$/),
}).openapi('ConfirmarTotp');

export const AtualizarUsuarioSchema = z.object({
  vinculo: VinculoSchema.optional(),
  area: AreaSchema.optional(),
  cidade: z.string().max(80).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  frentes: z.array(z.string().min(1).max(40)).optional(),
  permissoes: z.record(ModuloSchema, PermissaoModuloSchema).optional(),
  ativo: z.boolean().optional(),
}).openapi('AtualizarUsuario');

export const SolicitacaoAcessoSchema = z.object({
  id: z.string().uuid(),
  usuarioId: z.string().uuid(),
  modulo: ModuloSchema,
  nivel: NivelSchema,
  motivo: z.string(),
  status: z.enum(['pendente', 'autorizada', 'recusada']),
  criadaEm: z.string().datetime(),
  exemplo: z.boolean(),
}).openapi('SolicitacaoAcesso');
export type SolicitacaoAcessoDTO = z.infer<typeof SolicitacaoAcessoSchema>;

export const AuditoriaSchema = z.object({
  id: z.string().uuid(),
  atorId: z.string().uuid(),
  atorNome: z.string(),
  acao: z.string(),
  alvo: z.string(),
  detalhe: z.string(),
  criadaEm: z.string().datetime(),
}).openapi('Auditoria');
export type AuditoriaDTO = z.infer<typeof AuditoriaSchema>;

export const ColunaTarefaSchema = z.enum(['a_fazer', 'fazendo', 'revisao', 'feito']);
export const ProdutoTarefaSchema = z.enum(['thumdra', 'corujuris', 'spl', 'hub', 'infra', 'sob_medida']);

export const TarefaSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(3).max(160),
  coluna: ColunaTarefaSchema,
  produto: ProdutoTarefaSchema,
  responsavelId: z.string().uuid().nullable(),
  observadorIds: z.array(z.string().uuid()),
  referencia: z.string().nullable(),
  pullRequest: z.string().nullable(),
  prazo: z.string().datetime().nullable(),
  atrasada: z.boolean(),
  exemplo: z.boolean(),
  sincronizadaEm: z.string().datetime().nullable(),
  criadaEm: z.string().datetime(),
  atualizadaEm: z.string().datetime(),
}).openapi('Tarefa');
export type TarefaDTO = z.infer<typeof TarefaSchema>;

export const CriarTarefaSchema = z.object({
  titulo: z.string().min(3).max(160),
  coluna: ColunaTarefaSchema.optional(),
  produto: ProdutoTarefaSchema.optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  observadorIds: z.array(z.string().uuid()).optional(),
  referencia: z.string().max(80).nullable().optional(),
  pullRequest: z.string().max(40).nullable().optional(),
  prazo: z.string().datetime().nullable().optional(),
}).openapi('CriarTarefa');
export type CriarTarefaDTO = z.infer<typeof CriarTarefaSchema>;

export const AtualizarTarefaSchema = CriarTarefaSchema.partial().openapi('AtualizarTarefa');
export const PaginaTarefasSchema = pagina(TarefaSchema).openapi('PaginaTarefas');
export const PaginaUsuariosSchema = pagina(UsuarioSchema).openapi('PaginaUsuarios');

export const SincronizacaoSchema = z.object({
  modo: z.enum(['fake', 'http']),
  sincronizadas: z.number(),
  detalhes: z.string(),
  em: z.string().datetime(),
}).openapi('SincronizacaoTarefas');

export const NoticiaSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  titulo: z.string(),
  resumo: z.string(),
  corpo: z.string(),
  publicada: z.boolean(),
  publicadaEm: z.string().datetime().nullable(),
  autorNome: z.string(),
  exemplo: z.boolean(),
  criadaEm: z.string().datetime(),
}).openapi('Noticia');
export type NoticiaDTO = z.infer<typeof NoticiaSchema>;

export const NoticiaPublicaSchema = NoticiaSchema.pick({
  slug: true, titulo: true, resumo: true, corpo: true, publicadaEm: true, autorNome: true, exemplo: true,
}).openapi('NoticiaPublica');
export type NoticiaPublicaDTO = z.infer<typeof NoticiaPublicaSchema>;

export const CriarNoticiaSchema = z.object({
  titulo: z.string().min(3).max(160),
  resumo: z.string().min(3).max(400),
  corpo: z.string().min(3).max(20000),
  publicar: z.boolean().optional(),
}).openapi('CriarNoticia');

export const PaginaNoticiasSchema = pagina(NoticiaSchema).openapi('PaginaNoticias');
export const PaginaNoticiasPublicasSchema = pagina(NoticiaPublicaSchema).openapi('PaginaNoticiasPublicas');

/** Contrato /admin/v1 da Thumdra (lado consumidor). */
export const ThumdraUsuarioAdminSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  plano: z.string(),
  ativo: z.boolean(),
}).openapi('ThumdraUsuarioAdmin');
export type ThumdraUsuarioAdmin = z.infer<typeof ThumdraUsuarioAdminSchema>;
