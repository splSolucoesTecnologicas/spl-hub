import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { Problem } from '@spl/contracts';
import { ErroDeDominio } from './domain/erro-de-dominio.js';

const STATUS: Record<string, number> = {
  nao_encontrada: 404,
  nao_autenticado: 401,
  credenciais_invalidas: 401,
  codigo_invalido: 401,
  sem_permissao: 403,
  bloqueado: 429,
  github_stub: 501,
  github_nao_configurado: 501,
};

/** Converte erros em application/problem+json (RFC 9457). */
export function errorHandler(err: FastifyError | Error, _req: FastifyRequest, reply: FastifyReply) {
  let problema: Problem;
  if (err instanceof ZodError) {
    problema = { type: 'about:blank#validacao', title: 'Dados inválidos', status: 400, detail: err.issues.map((item) => item.message).join('; ') };
  } else if (err instanceof ErroDeDominio) {
    problema = { type: `about:blank#${err.codigo}`, title: err.message, status: STATUS[err.codigo] ?? 422 };
  } else {
    problema = { type: 'about:blank', title: 'Erro interno', status: 500 };
  }
  return reply.code(problema.status).type('application/problem+json').send(problema);
}
