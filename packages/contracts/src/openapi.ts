import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  AtualizarTarefaSchema, AtualizarUsuarioSchema, CriarNoticiaSchema, CriarTarefaSchema,
  LoginRespostaSchema, LoginSchema, NoticiaPublicaSchema, NoticiaSchema, PaginaNoticiasPublicasSchema,
  PaginaNoticiasSchema, PaginaTarefasSchema, PaginaUsuariosSchema, ProblemSchema, SincronizacaoSchema,
  TarefaSchema, TotpSchema, UsuarioSchema,
} from './index.js';

const r = new OpenAPIRegistry();
const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { 'application/json': { schema } } });
const problema = { description: 'Erro', content: { 'application/problem+json': { schema: ProblemSchema } } };

r.registerPath({ method: 'get', path: '/health', responses: { 200: { description: 'OK' } } });
r.registerPath({ method: 'post', path: '/acesso/login', request: { body: json(LoginSchema) }, responses: { 200: { description: 'Sessão ou desafio 2FA', ...json(LoginRespostaSchema) }, 401: problema } });
r.registerPath({ method: 'post', path: '/acesso/login/totp', request: { body: json(TotpSchema) }, responses: { 200: { description: 'Sessão', ...json(LoginRespostaSchema) }, 401: problema } });
r.registerPath({ method: 'get', path: '/acesso/eu', responses: { 200: { description: 'Usuário atual', ...json(UsuarioSchema) } } });
r.registerPath({ method: 'get', path: '/acesso/usuarios', responses: { 200: { description: 'Time', ...json(PaginaUsuariosSchema) } } });
r.registerPath({ method: 'patch', path: '/acesso/usuarios/{id}', request: { body: json(AtualizarUsuarioSchema) }, responses: { 200: { description: 'Atualizado', ...json(UsuarioSchema) }, 403: problema } });
r.registerPath({ method: 'get', path: '/tarefas', responses: { 200: { description: 'Quadro', ...json(PaginaTarefasSchema) } } });
r.registerPath({ method: 'post', path: '/tarefas', request: { body: json(CriarTarefaSchema) }, responses: { 201: { description: 'Criada', ...json(TarefaSchema) }, 400: problema } });
r.registerPath({ method: 'patch', path: '/tarefas/{id}', request: { body: json(AtualizarTarefaSchema) }, responses: { 200: { description: 'Atualizada', ...json(TarefaSchema) } } });
r.registerPath({ method: 'post', path: '/tarefas/sincronizar', responses: { 200: { description: 'Sync GitHub Projects', ...json(SincronizacaoSchema) } } });
r.registerPath({ method: 'get', path: '/blog', responses: { 200: { description: 'Notícias publicadas', ...json(PaginaNoticiasPublicasSchema) } } });
r.registerPath({ method: 'get', path: '/blog/{slug}', responses: { 200: { description: 'Notícia', ...json(NoticiaPublicaSchema) }, 404: problema } });
r.registerPath({ method: 'get', path: '/blog/admin', responses: { 200: { description: 'Todas, inclusive rascunhos', ...json(PaginaNoticiasSchema) } } });
r.registerPath({ method: 'post', path: '/blog/admin', request: { body: json(CriarNoticiaSchema) }, responses: { 201: { description: 'Criada', ...json(NoticiaSchema) } } });
r.registerPath({ method: 'post', path: '/blog/admin/{id}/publicar', responses: { 200: { description: 'Publicada', ...json(NoticiaSchema) } } });

const doc = new OpenApiGeneratorV31(r.definitions).generateDocument({
  openapi: '3.1.0',
  info: { title: 'SPL Hub API', version: '0.1.0', description: 'Monólito modular hexagonal do hub.splsolucoes.com' },
});
console.log(JSON.stringify(doc, null, 2));
