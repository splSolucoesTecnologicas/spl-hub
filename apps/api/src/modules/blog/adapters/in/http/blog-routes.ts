import type { FastifyInstance } from 'fastify';
import { CriarNoticiaSchema, type NoticiaDTO, type NoticiaPublicaDTO } from '@spl/contracts';
import type { CasosDeUsoAcesso } from '../../../../acesso/application/use-cases.js';
import { lerToken } from '../../../../acesso/adapters/in/http/acesso-routes.js';
import type { Noticia } from '../../../domain/noticia.js';
import type { CasosDeUsoBlog } from '../../../application/use-cases.js';

const dto = (noticia: Noticia): NoticiaDTO => ({
  id: noticia.id, slug: noticia.slug, titulo: noticia.titulo, resumo: noticia.resumo, corpo: noticia.corpo,
  publicada: noticia.publicada, publicadaEm: noticia.publicadaEm ? noticia.publicadaEm.toISOString() : null,
  autorNome: noticia.autorNome, exemplo: noticia.exemplo, criadaEm: noticia.criadaEm.toISOString(),
});

const publica = (noticia: Noticia): NoticiaPublicaDTO => ({
  slug: noticia.slug, titulo: noticia.titulo, resumo: noticia.resumo, corpo: noticia.corpo,
  publicadaEm: noticia.publicadaEm ? noticia.publicadaEm.toISOString() : null, autorNome: noticia.autorNome, exemplo: noticia.exemplo,
});

export function blogRoutes(casos: CasosDeUsoBlog, acesso: CasosDeUsoAcesso) {
  return async (app: FastifyInstance) => {
    const atorDe = (req: Parameters<typeof lerToken>[0]) => acesso.usuarioDoToken(lerToken(req));

    app.get<{ Querystring: { limite?: string; cursor?: string } }>('/blog/admin', async (req) => {
      const pagina = await casos.listarAdmin(await atorDe(req), { limite: req.query.limite ? Number(req.query.limite) : undefined, cursor: req.query.cursor });
      return { data: pagina.itens.map(dto), nextCursor: pagina.proximoCursor };
    });

    app.post('/blog/admin', async (req, reply) => {
      const body = CriarNoticiaSchema.parse(req.body);
      return reply.code(201).send(dto(await casos.criar(await atorDe(req), body)));
    });

    app.post<{ Params: { id: string } }>('/blog/admin/:id/publicar', async (req) => dto(await casos.publicar(await atorDe(req), req.params.id)));
    app.post<{ Params: { id: string } }>('/blog/admin/:id/despublicar', async (req) => dto(await casos.despublicar(await atorDe(req), req.params.id)));

    app.get<{ Querystring: { limite?: string; cursor?: string } }>('/blog', async (req) => {
      const pagina = await casos.listarPublicas({ limite: req.query.limite ? Number(req.query.limite) : undefined, cursor: req.query.cursor });
      return { data: pagina.itens.map(publica), nextCursor: pagina.proximoCursor };
    });

    app.get<{ Params: { slug: string } }>('/blog/:slug', async (req) => publica(await casos.obterPublica(req.params.slug)));
  };
}
