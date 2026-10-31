import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AtualizarUsuarioSchema, CriarUsuarioSchema, LoginSchema, TotpSchema, type LayoutInicioDTO, type UsuarioDTO } from '@spl/contracts';
import { ErroDeDominio } from '../../../../../shared/domain/erro-de-dominio.js';
import type { Modulo, Permissoes } from '../../../domain/usuario.js';
import { papeisDe, type Usuario } from '../../../domain/usuario.js';
import type { CasosDeUsoAcesso } from '../../../application/use-cases.js';

export function usuarioDto(usuario: Usuario): UsuarioDTO {
  return {
    id: usuario.id, nome: usuario.nome, email: usuario.email, vinculo: usuario.vinculo, area: usuario.area,
    papeis: papeisDe(usuario), cidade: usuario.cidade, uf: usuario.uf, latitude: usuario.latitude, longitude: usuario.longitude, ativo: usuario.ativo, admin: usuario.admin,
    totpAtivo: usuario.totpAtivo, permissoes: usuario.permissoes, layoutInicio: usuario.layoutInicio as LayoutInicioDTO | null, frentes: [...usuario.frentes], exemplo: usuario.exemplo,
    ultimoAcesso: usuario.ultimoAcesso ? usuario.ultimoAcesso.toISOString() : null,
  };
}

export function lerToken(req: FastifyRequest): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ErroDeDominio('nao_autenticado', 'Sessão ausente ou expirada');
  return header.slice('Bearer '.length).trim();
}

export function acessoRoutes(casos: CasosDeUsoAcesso) {
  const atorDe = (req: FastifyRequest) => casos.usuarioDoToken(lerToken(req));
  return async (app: FastifyInstance) => {
    app.post('/acesso/login', async (req) => {
      const body = LoginSchema.parse(req.body);
      const resultado = await casos.entrar(body);
      if (resultado.requer2fa) return { requer2fa: true, desafio: resultado.desafio };
      return { requer2fa: false, token: resultado.token, usuario: usuarioDto(resultado.usuario) };
    });

    app.post('/acesso/login/totp', async (req) => {
      const body = TotpSchema.parse(req.body);
      const resultado = await casos.confirmarTotp(body);
      return { requer2fa: false, token: resultado.token, usuario: usuarioDto(resultado.usuario) };
    });

    app.post('/acesso/logout', async (req, reply) => {
      await casos.sair(lerToken(req));
      return reply.code(204).send();
    });

    app.get('/acesso/eu', async (req) => usuarioDto(await atorDe(req)));

    app.get<{ Querystring: { limite?: string; cursor?: string } }>('/acesso/usuarios', async (req) => {
      const pagina = await casos.listarUsuarios(await atorDe(req), { limite: req.query.limite ? Number(req.query.limite) : undefined, cursor: req.query.cursor });
      return { data: pagina.itens.map(usuarioDto), nextCursor: pagina.proximoCursor };
    });

    app.post('/acesso/usuarios', async (req, reply) => {
      const body = CriarUsuarioSchema.parse(req.body);
      return reply.code(201).send(usuarioDto(await casos.criarPorAdmin(await atorDe(req), body)));
    });

    app.patch<{ Params: { id: string } }>('/acesso/usuarios/:id', async (req) => {
      const body = AtualizarUsuarioSchema.parse(req.body);
      const atualizado = await casos.atualizarUsuario(await atorDe(req), req.params.id, { ...body, permissoes: body.permissoes as Permissoes | undefined });
      return usuarioDto(atualizado);
    });

    app.delete<{ Params: { id: string } }>('/acesso/usuarios/:id', async (req, reply) => {
      await casos.excluirUsuario(await atorDe(req), req.params.id);
      return reply.code(204).send();
    });

    app.post('/acesso/totp/iniciar', async (req) => casos.iniciarTotp(await atorDe(req)));

    app.post<{ Body: { codigo?: string } }>('/acesso/totp/confirmar', async (req) => {
      const codigo = TotpSchema.shape.codigo.parse((req.body as { codigo?: string } | undefined)?.codigo);
      return usuarioDto(await casos.confirmarTotpProprio(await atorDe(req), codigo));
    });

    app.get('/acesso/solicitacoes', async (req) => {
      const itens = await casos.listarSolicitacoes(await atorDe(req));
      return { data: itens.map((item) => ({ ...item.toJSON(), criadaEm: item.criadaEm.toISOString(), modulo: item.modulo as Modulo })) };
    });

    app.post<{ Params: { id: string } }>('/acesso/solicitacoes/:id/autorizar', async (req) => {
      const item = await casos.decidirSolicitacao(await atorDe(req), req.params.id, 'autorizada');
      return { ...item.toJSON(), criadaEm: item.criadaEm.toISOString() };
    });

    app.post<{ Params: { id: string } }>('/acesso/solicitacoes/:id/recusar', async (req) => {
      const item = await casos.decidirSolicitacao(await atorDe(req), req.params.id, 'recusada');
      return { ...item.toJSON(), criadaEm: item.criadaEm.toISOString() };
    });

    app.get('/acesso/auditoria', async (req) => {
      const ator = await atorDe(req);
      const eventos = await casos.listarAuditoria(ator);
      const usuarios = await casos.listarUsuarios(ator, { limite: 100 });
      const nomes = new Map(usuarios.itens.map((usuario) => [usuario.id, usuario.nome]));
      return { data: eventos.map((evento) => ({ ...evento, atorNome: nomes.get(evento.atorId) ?? 'SPL', criadaEm: evento.criadaEm.toISOString() })) };
    });
  };
}
