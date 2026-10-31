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
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
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
  nome: z.string().min(2).max(80).optional(),
  vinculo: VinculoSchema.optional(),
  area: AreaSchema.optional(),
  cidade: z.string().max(80).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  frentes: z.array(z.string().min(1).max(40)).optional(),
  permissoes: z.record(ModuloSchema, PermissaoModuloSchema).optional(),
  ativo: z.boolean().optional(),
  admin: z.boolean().optional(),
}).openapi('AtualizarUsuario');

export const CriarUsuarioSchema = z.object({
  nome: z.string().min(2).max(80),
  email: z.string().email(),
  senha: z.string().min(8).max(200),
  vinculo: VinculoSchema,
  area: AreaSchema,
  cidade: z.string().max(80).nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  admin: z.boolean().optional(),
}).openapi('CriarUsuario');

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
  projetoId: z.string().uuid().nullable(),
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
  projetoId: z.string().uuid().nullable().optional(),
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

export const AtualizarNoticiaSchema = CriarNoticiaSchema.pick({ titulo: true, resumo: true, corpo: true }).partial().openapi('AtualizarNoticia');

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

export const TipoProjetoSchema = z.enum(['produto', 'sob_medida', 'interno']);
export const StatusProjetoSchema = z.enum(['piloto', 'validacao', 'em_desenvolvimento', 'proposta', 'pausado', 'concluido']);
export const AreaResponsavelSchema = z.enum(['dev', 'marketing', 'administracao', 'comercial', 'financeiro', 'juridico', 'infra', 'admin_produto']);
export const StatusMarcoSchema = z.enum(['em_andamento', 'aguardando_resposta', 'em_revisao', 'feito']);

export const ResponsavelProjetoSchema = z.object({
  area: AreaResponsavelSchema,
  usuarioId: z.string().uuid(),
}).openapi('ResponsavelProjeto');

export const MarcoProjetoSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  status: StatusMarcoSchema,
  detalhe: z.string(),
  ordem: z.number().int(),
}).openapi('MarcoProjeto');

export const ProjetoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  tipo: TipoProjetoSchema,
  status: StatusProjetoSchema,
  descricao: z.string(),
  cor: z.string(),
  repositorio: z.string().nullable(),
  quadroUrl: z.string().nullable(),
  adminUrl: z.string().nullable(),
  progresso: z.number().int(),
  progressoRotulo: z.string(),
  responsaveis: z.array(ResponsavelProjetoSchema),
  clienteIds: z.array(z.string().uuid()),
  marcos: z.array(MarcoProjetoSchema),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
}).openapi('Projeto');
export type ProjetoDTO = z.infer<typeof ProjetoSchema>;

const urlOpcional = z.union([z.string().url().max(300), z.literal(''), z.null()]).optional();

export const CriarProjetoSchema = z.object({
  nome: z.string().min(2).max(80),
  tipo: TipoProjetoSchema,
  status: StatusProjetoSchema,
  descricao: z.string().max(400).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  repositorio: z.string().max(120).nullable().optional(),
  quadroUrl: urlOpcional,
  adminUrl: urlOpcional,
  progresso: z.number().int().min(0).max(100).optional(),
  progressoRotulo: z.string().max(80).optional(),
  responsaveis: z.array(ResponsavelProjetoSchema).optional(),
  clienteIds: z.array(z.string().uuid()).optional(),
  marcos: z.array(z.object({
    id: z.string().uuid().optional(),
    titulo: z.string().min(2).max(120),
    status: StatusMarcoSchema,
    detalhe: z.string().max(40).optional(),
    ordem: z.number().int().optional(),
  })).optional(),
}).openapi('CriarProjeto');
export const AtualizarProjetoSchema = CriarProjetoSchema.partial().openapi('AtualizarProjeto');
export const PaginaProjetosSchema = pagina(ProjetoSchema).openapi('PaginaProjetos');

export const ClienteSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  cidade: z.string(),
  uf: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: z.string(),
  responsavelId: z.string().uuid().nullable(),
  ultimoContato: z.string().datetime().nullable(),
  observacoes: z.string(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
}).openapi('Cliente');
export type ClienteDTO = z.infer<typeof ClienteSchema>;

export const CriarClienteSchema = z.object({
  nome: z.string().min(2).max(120),
  cidade: z.string().min(2).max(80),
  uf: z.string().length(2),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  status: z.string().min(2).max(40),
  responsavelId: z.string().uuid().nullable().optional(),
  ultimoContato: z.string().datetime().nullable().optional(),
  observacoes: z.string().max(4000).optional(),
}).openapi('CriarCliente');
export const AtualizarClienteSchema = CriarClienteSchema.partial().openapi('AtualizarCliente');
export const PaginaClientesSchema = pagina(ClienteSchema).openapi('PaginaClientes');

export const DecisaoSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  detalhe: z.string(),
  quando: z.string().datetime(),
  autorId: z.string().uuid(),
  criadoEm: z.string().datetime(),
}).openapi('Decisao');
export type DecisaoDTO = z.infer<typeof DecisaoSchema>;

export const CriarDecisaoSchema = z.object({
  titulo: z.string().min(3).max(160),
  detalhe: z.string().max(2000).optional(),
  quando: z.string().datetime().optional(),
}).openapi('CriarDecisao');
export const AtualizarDecisaoSchema = CriarDecisaoSchema.partial().openapi('AtualizarDecisao');

export const ObjetivoSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  progresso: z.number().int(),
  periodo: z.string(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
}).openapi('Objetivo');
export type ObjetivoDTO = z.infer<typeof ObjetivoSchema>;

export const CriarObjetivoSchema = z.object({
  titulo: z.string().min(3).max(160),
  progresso: z.number().int().min(0).max(100),
  periodo: z.string().min(2).max(40),
}).openapi('CriarObjetivo');
export const AtualizarObjetivoSchema = CriarObjetivoSchema.partial().openapi('AtualizarObjetivo');

export { geocodificar, listarCidades, type CidadeGeo } from './cidades.js';
