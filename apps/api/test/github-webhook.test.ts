import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { eventoDoPayload, githubWebhookRoutes, verificarAssinatura } from '../src/modules/tarefas/adapters/in/http/github-webhook-routes.js';
import { criarCasosDeUsoTarefas } from '../src/modules/tarefas/application/use-cases.js';
import { InMemoryTarefaRepository } from '../src/modules/tarefas/adapters/out/in-memory-tarefa-repository.js';
import { InMemoryProjetoRepository } from '../src/modules/operacao/adapters/out/memoria.js';
import { FakeGitHubProjetos } from '../src/integrations/github/fake-github-projetos.js';
import { Projeto } from '../src/modules/operacao/domain/projeto.js';

describe('verificarAssinatura', () => {
  it('aceita uma assinatura HMAC-SHA256 valida', () => {
    const corpo = Buffer.from('{"a":1}');
    const secret = 'segredo-teste';
    const assinatura = 'sha256=' + createHmac('sha256', secret).update(corpo).digest('hex');
    expect(verificarAssinatura(corpo, assinatura, secret)).toBe(true);
  });
  it('rejeita assinatura ausente ou errada', () => {
    const corpo = Buffer.from('{"a":1}');
    expect(verificarAssinatura(corpo, undefined, 'segredo-teste')).toBe(false);
    expect(verificarAssinatura(corpo, 'sha256=errado', 'segredo-teste')).toBe(false);
  });
});

describe('eventoDoPayload', () => {
  it('traduz a mudança de status de um item do board', () => {
    const payload = { action: 'edited', projects_v2_item: { node_id: 'PVTI_1' }, changes: { field_value: { to: { id: 'opt-feito' } } } };
    expect(eventoDoPayload('projects_v2_item', payload)).toEqual({ tipo: 'item_do_board', itemNodeId: 'PVTI_1', opcaoStatusId: 'opt-feito' });
  });

  it('ignora eventos que o Hub não acompanha e payload malformado', () => {
    expect(eventoDoPayload('push', { ref: 'main' })).toBeNull();
    expect(eventoDoPayload('issues', { action: 'labeled', issue: { number: 1, title: 'x', state: 'open' }, repository: { full_name: 'a/b' } })).toBeNull();
    expect(eventoDoPayload('issues', { action: 'opened', issue: { number: '1' }, repository: { full_name: 'a/b' } })).toBeNull();
  });
});

describe('POST /github/webhook', () => {
  const SECRET = 'segredo-teste';
  const AGORA = new Date('2026-10-31T12:00:00.000Z');

  function montarApp() {
    const tarefas = new InMemoryTarefaRepository();
    const projetos = new InMemoryProjetoRepository();
    const casos = criarCasosDeUsoTarefas({ repo: tarefas, projetos, github: new FakeGitHubProjetos(), relogio: { agora: () => AGORA }, ids: { novo: () => 'nova-tarefa-1' } });
    const app = Fastify();
    app.register(githubWebhookRoutes({ tarefas: casos, webhookSecret: SECRET }));
    return { app, tarefas, projetos };
  }

  function assinar(corpo: object) {
    const buf = Buffer.from(JSON.stringify(corpo));
    return 'sha256=' + createHmac('sha256', SECRET).update(buf).digest('hex');
  }

  it('rejeita payload sem assinatura valida', async () => {
    const { app } = montarApp();
    await app.ready();
    const resposta = await app.inject({ method: 'POST', url: '/github/webhook', headers: { 'x-github-event': 'issues' }, payload: { action: 'opened' } });
    expect(resposta.statusCode).toBe(401);
  });

  it('cria uma tarefa quando uma issue nova abre num repo vinculado', async () => {
    const { app, projetos, tarefas } = montarApp();
    const projeto = Projeto.criar({ id: 'proj1', nome: 'Com GitHub', tipo: 'produto', status: 'piloto', cor: '#4c8dff', agora: AGORA, repositorio: 'spl/teste' });
    await projetos.salvar(projeto);
    await app.ready();
    const payload = { action: 'opened', issue: { number: 7, title: 'Bug achado no GitHub', state: 'open', node_id: 'IT_kwdOA' }, repository: { full_name: 'spl/teste' } };
    const resposta = await app.inject({ method: 'POST', url: '/github/webhook', headers: { 'x-github-event': 'issues', 'x-hub-signature-256': assinar(payload) }, payload });
    expect(resposta.statusCode).toBe(200);
    const todas = await tarefas.listarTodas();
    expect(todas).toHaveLength(1);
    expect(todas[0]!.titulo).toBe('Bug achado no GitHub');
    expect(todas[0]!.githubIssueNumero).toBe(7);
  });
});
