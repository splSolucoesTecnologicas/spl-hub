import { afterAll, describe, expect, it } from 'vitest';
import { adminLogado } from './memoria.js';

const ctx = await adminLogado();
afterAll(() => ctx.app.close());

describe('API HTTP', () => {
  it('fluxo de tarefas autenticado', async () => {
    const criada = await ctx.app.inject({ method: 'POST', url: '/tarefas', headers: { authorization: `Bearer ${ctx.token}` }, payload: { titulo: 'Montar o quadro', produto: 'hub' } });
    expect(criada.statusCode).toBe(201);
    const id = criada.json().id as string;
    const movida = await ctx.app.inject({ method: 'PATCH', url: `/tarefas/${id}`, headers: { authorization: `Bearer ${ctx.token}` }, payload: { coluna: 'revisao' } });
    expect(movida.json().coluna).toBe('revisao');
    const sync = await ctx.app.inject({ method: 'POST', url: '/tarefas/sincronizar', headers: { authorization: `Bearer ${ctx.token}` } });
    expect(sync.json().modo).toBe('fake');
    const curta = await ctx.app.inject({ method: 'POST', url: '/tarefas', headers: { authorization: `Bearer ${ctx.token}` }, payload: { titulo: 'ab' } });
    expect(curta.statusCode).toBe(400);
    expect(curta.headers['content-type']).toContain('application/problem+json');
  });

  it('blog público não exige sessão e rascunho fica de fora', async () => {
    const criada = await ctx.app.inject({
      method: 'POST', url: '/blog/admin', headers: { authorization: `Bearer ${ctx.token}` },
      payload: { titulo: 'Nota interna', resumo: 'Resumo de exemplo', corpo: 'Corpo de exemplo', publicar: false },
    });
    expect(criada.statusCode).toBe(201);
    const vazia = await ctx.app.inject({ method: 'GET', url: '/blog' });
    expect(vazia.json().data).toEqual([]);
    await ctx.app.inject({ method: 'POST', url: `/blog/admin/${criada.json().id}/publicar`, headers: { authorization: `Bearer ${ctx.token}` } });
    const lista = await ctx.app.inject({ method: 'GET', url: '/blog' });
    expect(lista.json().data[0].slug).toBe('nota-interna');
    const uma = await ctx.app.inject({ method: 'GET', url: '/blog/nota-interna' });
    expect(uma.statusCode).toBe(200);
    const sumiu = await ctx.app.inject({ method: 'GET', url: '/blog/nao-existe' });
    expect(sumiu.statusCode).toBe(404);
  });

  it('cria cliente geocodificado e projeto, e os dois começam vazios depois da exclusão', async () => {
    const criada = await ctx.app.inject({
      method: 'POST', url: '/clientes', headers: { authorization: `Bearer ${ctx.token}` },
      payload: { nome: 'Costa Adv.', cidade: 'São Paulo', uf: 'SP', status: 'Ativo' },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json().latitude).toBeCloseTo(-23.55, 1);
    const projeto = await ctx.app.inject({
      method: 'POST', url: '/projetos', headers: { authorization: `Bearer ${ctx.token}` },
      payload: { nome: 'Thumdra', tipo: 'produto', status: 'piloto', cor: '#4c8dff', clienteIds: [criada.json().id], repositorio: 'spl-solucoes/thumdra' },
    });
    expect(projeto.statusCode).toBe(201);
    const lista = await ctx.app.inject({ method: 'GET', url: '/projetos', headers: { authorization: `Bearer ${ctx.token}` } });
    expect(lista.json().data).toHaveLength(1);
    expect((await ctx.app.inject({ method: 'DELETE', url: `/projetos/${projeto.json().id}`, headers: { authorization: `Bearer ${ctx.token}` } })).statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'DELETE', url: `/clientes/${criada.json().id}`, headers: { authorization: `Bearer ${ctx.token}` } })).statusCode).toBe(204);
    const vazia = await ctx.app.inject({ method: 'GET', url: '/clientes', headers: { authorization: `Bearer ${ctx.token}` } });
    expect(vazia.json().data).toEqual([]);
  });

  it('recusa tarefa sem sessão', async () => {
    const resposta = await ctx.app.inject({ method: 'GET', url: '/tarefas' });
    expect(resposta.statusCode).toBe(401);
  });

  it('lista usuários da Thumdra pelo fake quando o admin tem permissão', async () => {
    const resposta = await ctx.app.inject({ method: 'GET', url: '/integracoes/thumdra/usuarios', headers: { authorization: `Bearer ${ctx.token}` } });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json().data).toHaveLength(2);
  });
});
