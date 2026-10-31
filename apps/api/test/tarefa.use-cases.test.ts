import { describe, expect, it } from 'vitest';
import { criarCasosDeUsoTarefas } from '../src/modules/tarefas/application/use-cases.js';
import { Projeto } from '../src/modules/operacao/domain/projeto.js';
import type { FakeGitHubProjetos } from '../src/modules/tarefas/adapters/out/fake-github-projetos.js';
import { memoria } from './memoria.js';

describe('Casos de uso de tarefas', () => {
  it('cria, move de coluna e sincroniza no fake do GitHub', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const casos = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, projetos: deps.projetos, relogio: deps.relogio, ids: deps.ids });
    const criada = await casos.criar(admin, { titulo: 'Migrar CI para VPS Dokploy', produto: 'infra' });
    expect(criada.responsavelId).toBe(admin.id);
    expect((await casos.atualizar(admin, criada.id, { coluna: 'fazendo' })).coluna).toBe('fazendo');
    const sync = await casos.sincronizar(admin);
    expect(sync.modo).toBe('fake');
    expect(sync.sincronizadas).toBe(1);
    const lista = await casos.listar(admin, { filtro: 'minhas' });
    expect(lista.itens[0]?.referencia).toMatch(/^spl-hub#/);
  });

  it('cria a issue no GitHub quando a tarefa pertence a um projeto vinculado', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const projeto = Projeto.criar({ id: 'proj1', nome: 'Com GitHub', tipo: 'produto', status: 'piloto', cor: '#4c8dff', agora: deps.relogio.agora(), repositorio: 'spl/teste' });
    projeto.atualizar({ githubProjectNumero: 1, githubColunaMap: { a_fazer: 'opt-a-fazer', fazendo: 'opt-fazendo', revisao: 'opt-revisao', feito: 'opt-feito' } }, deps.relogio.agora());
    await deps.projetos.salvar(projeto);
    const casos = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, projetos: deps.projetos, relogio: deps.relogio, ids: deps.ids });
    const tarefa = await casos.criar(admin, { titulo: 'Linkar com GitHub', projetoId: 'proj1' });
    expect(tarefa.githubIssueNumero).not.toBeNull();
  });

  it('importa issues que já existiam no repo antes do projeto ser vinculado', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const projeto = Projeto.criar({ id: 'proj1', nome: 'Com GitHub', tipo: 'produto', status: 'piloto', cor: '#4c8dff', agora: deps.relogio.agora(), repositorio: 'spl/teste' });
    await deps.projetos.salvar(projeto);
    const github = deps.github as FakeGitHubProjetos;
    github.semearIssueExistente('spl', 'teste', { numero: 10, titulo: 'Bug antigo', estado: 'open' });
    github.semearIssueExistente('spl', 'teste', { numero: 11, titulo: 'Já resolvido', estado: 'closed' });
    const casos = criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, projetos: deps.projetos, relogio: deps.relogio, ids: deps.ids });
    const resultado = await casos.importarIssuesDoProjeto(admin, 'proj1');
    expect(resultado).toEqual({ importadas: 2, total: 2 });
    const tarefas = await casos.listar(admin, { projetoId: 'proj1', filtro: 'todas' });
    expect(tarefas.itens).toHaveLength(2);
    expect(tarefas.itens.find((t) => t.titulo === 'Já resolvido')?.coluna).toBe('feito');
    const segunda = await casos.importarIssuesDoProjeto(admin, 'proj1');
    expect(segunda).toEqual({ importadas: 0, total: 2 });
  });
});
