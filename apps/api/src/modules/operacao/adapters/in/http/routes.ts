import type { FastifyInstance } from 'fastify';
import {
  AtualizarClienteSchema, AtualizarDecisaoSchema, AtualizarObjetivoSchema, AtualizarProjetoSchema,
  CriarClienteSchema, CriarDecisaoSchema, CriarObjetivoSchema, CriarProjetoSchema,
  type ClienteDTO, type DecisaoDTO, type ObjetivoDTO, type ProjetoDTO,
} from '@spl/contracts';
import type { CasosDeUsoAcesso } from '../../../../acesso/application/use-cases.js';
import { lerToken } from '../../../../acesso/adapters/in/http/acesso-routes.js';
import type { Cliente } from '../../../domain/cliente.js';
import type { Projeto } from '../../../domain/projeto.js';
import type { Decisao, Objetivo } from '../../../domain/socios.js';
import type { CasosDeUsoOperacao } from '../../../application/use-cases.js';

const clienteDto = (cliente: Cliente): ClienteDTO => ({
  id: cliente.id, nome: cliente.nome, cidade: cliente.cidade, uf: cliente.uf, latitude: cliente.latitude, longitude: cliente.longitude,
  status: cliente.status, responsavelId: cliente.responsavelId, observacoes: cliente.observacoes,
  ultimoContato: cliente.ultimoContato ? cliente.ultimoContato.toISOString() : null,
  criadoEm: cliente.criadoEm.toISOString(), atualizadoEm: cliente.atualizadoEm.toISOString(),
});

const projetoDto = (projeto: Projeto): ProjetoDTO => ({
  ...projeto.toJSON(),
  criadoEm: projeto.criadoEm.toISOString(),
  atualizadoEm: projeto.atualizadoEm.toISOString(),
});

const decisaoDto = (decisao: Decisao): DecisaoDTO => ({
  id: decisao.id, titulo: decisao.titulo, detalhe: decisao.detalhe, autorId: decisao.autorId,
  quando: decisao.quando.toISOString(), criadoEm: decisao.criadoEm.toISOString(),
});

const objetivoDto = (objetivo: Objetivo): ObjetivoDTO => ({
  id: objetivo.id, titulo: objetivo.titulo, progresso: objetivo.progresso, periodo: objetivo.periodo,
  criadoEm: objetivo.criadoEm.toISOString(), atualizadoEm: objetivo.atualizadoEm.toISOString(),
});

export function operacaoRoutes(casos: CasosDeUsoOperacao, acesso: CasosDeUsoAcesso) {
  return async (app: FastifyInstance) => {
    const atorDe = (req: Parameters<typeof lerToken>[0]) => acesso.usuarioDoToken(lerToken(req));

    app.get<{ Querystring: { limite?: string; cursor?: string } }>('/clientes', async (req) => {
      const pagina = await casos.listarClientes(await atorDe(req), { limite: req.query.limite ? Number(req.query.limite) : undefined, cursor: req.query.cursor });
      return { data: pagina.itens.map(clienteDto), nextCursor: pagina.proximoCursor };
    });
    app.post('/clientes', async (req, reply) => {
      const body = CriarClienteSchema.parse(req.body);
      const criado = await casos.criarCliente(await atorDe(req), { ...body, ultimoContato: body.ultimoContato ? new Date(body.ultimoContato) : null });
      return reply.code(201).send(clienteDto(criado));
    });
    app.patch<{ Params: { id: string } }>('/clientes/:id', async (req) => {
      const body = AtualizarClienteSchema.parse(req.body);
      const atualizado = await casos.atualizarCliente(await atorDe(req), req.params.id, {
        ...body, ultimoContato: body.ultimoContato === undefined ? undefined : body.ultimoContato ? new Date(body.ultimoContato) : null,
      });
      return clienteDto(atualizado);
    });
    app.delete<{ Params: { id: string } }>('/clientes/:id', async (req, reply) => {
      await casos.removerCliente(await atorDe(req), req.params.id);
      return reply.code(204).send();
    });

    app.get<{ Querystring: { limite?: string; cursor?: string } }>('/projetos', async (req) => {
      const pagina = await casos.listarProjetos(await atorDe(req), { limite: req.query.limite ? Number(req.query.limite) : undefined, cursor: req.query.cursor });
      return { data: pagina.itens.map(projetoDto), nextCursor: pagina.proximoCursor };
    });
    app.post('/projetos', async (req, reply) => {
      const body = CriarProjetoSchema.parse(req.body);
      return reply.code(201).send(projetoDto(await casos.criarProjeto(await atorDe(req), body)));
    });
    app.get<{ Params: { id: string } }>('/projetos/:id', async (req) => projetoDto(await casos.obterProjeto(await atorDe(req), req.params.id)));
    app.patch<{ Params: { id: string } }>('/projetos/:id', async (req) => {
      const body = AtualizarProjetoSchema.parse(req.body);
      return projetoDto(await casos.atualizarProjeto(await atorDe(req), req.params.id, body));
    });
    app.delete<{ Params: { id: string } }>('/projetos/:id', async (req, reply) => {
      await casos.removerProjeto(await atorDe(req), req.params.id);
      return reply.code(204).send();
    });

    app.get('/decisoes', async (req) => ({ data: (await casos.listarDecisoes(await atorDe(req))).map(decisaoDto) }));
    app.post('/decisoes', async (req, reply) => {
      const body = CriarDecisaoSchema.parse(req.body);
      return reply.code(201).send(decisaoDto(await casos.criarDecisao(await atorDe(req), { ...body, quando: body.quando ? new Date(body.quando) : undefined })));
    });
    app.patch<{ Params: { id: string } }>('/decisoes/:id', async (req) => {
      const body = AtualizarDecisaoSchema.parse(req.body);
      return decisaoDto(await casos.atualizarDecisao(await atorDe(req), req.params.id, { ...body, quando: body.quando ? new Date(body.quando) : undefined }));
    });
    app.delete<{ Params: { id: string } }>('/decisoes/:id', async (req, reply) => {
      await casos.removerDecisao(await atorDe(req), req.params.id);
      return reply.code(204).send();
    });

    app.get('/objetivos', async (req) => ({ data: (await casos.listarObjetivos(await atorDe(req))).map(objetivoDto) }));
    app.post('/objetivos', async (req, reply) => {
      const body = CriarObjetivoSchema.parse(req.body);
      return reply.code(201).send(objetivoDto(await casos.criarObjetivo(await atorDe(req), body)));
    });
    app.patch<{ Params: { id: string } }>('/objetivos/:id', async (req) => {
      const body = AtualizarObjetivoSchema.parse(req.body);
      return objetivoDto(await casos.atualizarObjetivo(await atorDe(req), req.params.id, body));
    });
    app.delete<{ Params: { id: string } }>('/objetivos/:id', async (req, reply) => {
      await casos.removerObjetivo(await atorDe(req), req.params.id);
      return reply.code(204).send();
    });
  };
}
