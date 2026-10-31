import type { FastifyInstance } from 'fastify';
import type { CasosDeUsoAcesso } from '../../modules/acesso/application/use-cases.js';
import { lerToken } from '../../modules/acesso/adapters/in/http/acesso-routes.js';
import type { ThumdraAdminClient } from './thumdra-admin-client.js';

export function thumdraRoutes(client: ThumdraAdminClient, acesso: CasosDeUsoAcesso) {
  return async (app: FastifyInstance) => {
    app.get<{ Querystring: { cursor?: string; limite?: string } }>('/integracoes/thumdra/usuarios', async (req) => {
      const ator = await acesso.usuarioDoToken(lerToken(req));
      ator.exigir('admin_thumdra', 'ler');
      return client.listarUsuarios({ cursor: req.query.cursor, limite: req.query.limite ? Number(req.query.limite) : undefined }, ator.email);
    });
    app.post<{ Params: { id: string }; Headers: { 'idempotency-key'?: string } }>('/integracoes/thumdra/usuarios/:id/desativar', async (req, reply) => {
      const ator = await acesso.usuarioDoToken(lerToken(req));
      ator.exigir('admin_thumdra', 'editar');
      const chave = req.headers['idempotency-key'];
      if (!chave) return reply.code(400).type('application/problem+json').send({ type: 'about:blank#validacao', title: 'Idempotency-Key obrigatório', status: 400 });
      await client.desativarUsuario(req.params.id, ator.email, chave);
      return reply.code(204).send();
    });
  };
}
