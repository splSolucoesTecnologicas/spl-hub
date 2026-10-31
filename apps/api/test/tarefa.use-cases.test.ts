import { describe, expect, it } from 'vitest';
import { criarCasosDeUsoTarefas } from '../src/modules/tarefas/application/use-cases.js';
import { StubGitHubProjetos } from '../src/modules/tarefas/adapters/out/stub-github-projetos.js';
import { memoria } from './memoria.js';

describe('Casos de uso de tarefas', () => {
  it('cria, move de coluna e sincroniza no fake do GitHub', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const casos = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, relogio: deps.relogio, ids: deps.ids });
    const criada = await casos.criar(admin, { titulo: 'Migrar CI para VPS Dokploy', produto: 'infra' });
    expect(criada.responsavelId).toBe(admin.id);
    expect((await casos.atualizar(admin, criada.id, { coluna: 'fazendo' })).coluna).toBe('fazendo');
    const sync = await casos.sincronizar(admin);
    expect(sync.modo).toBe('fake');
    expect(sync.sincronizadas).toBe(1);
    const lista = await casos.listar(admin, { filtro: 'minhas' });
    expect(lista.itens[0]?.referencia).toMatch(/^spl-hub#/);
  });

  it('o adapter HTTP stubado não chama o GitHub', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const casos = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: new StubGitHubProjetos({}), relogio: deps.relogio, ids: deps.ids });
    await casos.criar(admin, { titulo: 'Contrato' });
    await expect(casos.sincronizar(admin)).rejects.toThrow(/GITHUB_TOKEN/);
    const configurado = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: new StubGitHubProjetos({ token: 'x', owner: 'spl', project: '1' }), relogio: deps.relogio, ids: deps.ids });
    await expect(configurado.sincronizar(admin)).rejects.toThrow(/esboçado/);
  });
});
