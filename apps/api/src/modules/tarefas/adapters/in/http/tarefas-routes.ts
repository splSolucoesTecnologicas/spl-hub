import type { FastifyInstance } from 'fastify';
import { AtualizarTarefaSchema, CriarTarefaSchema, type TarefaDTO } from '@spl/contracts';
import type { CasosDeUsoAcesso } from '../../../../acesso/application/use-cases.js';
import { lerToken } from '../../../../acesso/adapters/in/http/acesso-routes.js';
import type { Tarefa } from '../../../domain/tarefa.js';
import type { CasosDeUsoTarefas } from '../../../application/use-cases.js';

const dto = (tarefa: Tarefa, agora: Date): TarefaDTO => ({
  id: tarefa.id, titulo: tarefa.titulo, coluna: tarefa.coluna, produto: tarefa.produto,
  responsavelId: tarefa.responsavelId, observadorIds: [...tarefa.observadorIds], projetoId: tarefa.projetoId, referencia: tarefa.referencia,
  pullRequest: tarefa.pullRequest, githubIssueNumero: tarefa.githubIssueNumero, prazo: tarefa.prazo ? tarefa.prazo.toISOString() : null, atrasada: tarefa.estaAtrasada(agora),
  exemplo: tarefa.exemplo, sincronizadaEm: tarefa.sincronizadaEm ? tarefa.sincronizadaEm.toISOString() : null,
  criadaEm: tarefa.criadaEm.toISOString(), atualizadaEm: tarefa.atualizadaEm.toISOString(),
});

export function tarefasRoutes(casos: CasosDeUsoTarefas, acesso: CasosDeUsoAcesso, agora: () => Date) {
  return async (app: FastifyInstance) => {
    const atorDe = (req: Parameters<typeof lerToken>[0]) => acesso.usuarioDoToken(lerToken(req));

    app.get<{ Querystring: { limite?: string; cursor?: string; coluna?: TarefaDTO['coluna']; responsavelId?: string; produto?: TarefaDTO['produto']; projetoId?: string; filtro?: 'minhas' | 'de_olho' | 'todas' } }>('/tarefas', async (req) => {
      const pagina = await casos.listar(await atorDe(req), {
        limite: req.query.limite ? Number(req.query.limite) : undefined,
        cursor: req.query.cursor,
        coluna: req.query.coluna,
        responsavelId: req.query.responsavelId,
        produto: req.query.produto,
        projetoId: req.query.projetoId,
        filtro: req.query.filtro,
      });
      const instante = agora();
      return { data: pagina.itens.map((tarefa) => dto(tarefa, instante)), nextCursor: pagina.proximoCursor };
    });

    app.post('/tarefas', async (req, reply) => {
      const body = CriarTarefaSchema.parse(req.body);
      const criada = await casos.criar(await atorDe(req), { ...body, prazo: body.prazo == null ? null : new Date(body.prazo) });
      return reply.code(201).send(dto(criada, agora()));
    });

    app.patch<{ Params: { id: string } }>('/tarefas/:id', async (req) => {
      const body = AtualizarTarefaSchema.parse(req.body);
      const atualizada = await casos.atualizar(await atorDe(req), req.params.id, {
        ...body,
        prazo: body.prazo === undefined ? undefined : body.prazo === null ? null : new Date(body.prazo),
      });
      return dto(atualizada, agora());
    });

    app.delete<{ Params: { id: string } }>('/tarefas/:id', async (req, reply) => {
      await casos.remover(await atorDe(req), req.params.id);
      return reply.code(204).send();
    });

    app.post('/tarefas/sincronizar', async (req) => {
      const resultado = await casos.sincronizar(await atorDe(req));
      return { ...resultado, em: resultado.em.toISOString() };
    });
  };
}
