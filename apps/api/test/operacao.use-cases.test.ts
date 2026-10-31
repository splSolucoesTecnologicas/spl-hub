import { describe, expect, it } from 'vitest';
import { criarCasosDeUsoOperacao } from '../src/modules/operacao/application/use-cases.js';
import { memoria } from './memoria.js';

describe('Casos de uso de operação — GitHub', () => {
  it('lista repositorios, boards e opcoes de status via o adapter configurado', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const operacao = criarCasosDeUsoOperacao(deps);
    const repos = await operacao.listarRepositoriosGithub(admin);
    expect(repos.length).toBeGreaterThan(0);
    const boards = await operacao.listarProjetosGithub(admin, repos[0]!.owner, repos[0]!.nome);
    expect(boards.length).toBeGreaterThan(0);
    const opcoes = await operacao.listarOpcoesStatusGithub(admin, repos[0]!.owner, repos[0]!.nome, boards[0]!.numero);
    expect(opcoes.map((o) => o.nome)).toContain('Done');
  });

  it('colaborador sem permissao de editar projetos nao lista repositorios', async () => {
    const deps = memoria();
    const colaborador = await deps.acesso.criarUsuario({ nome: 'Lucas', email: 'lucas@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'colaborador', area: 'dev' });
    const operacao = criarCasosDeUsoOperacao(deps);
    await expect(operacao.listarRepositoriosGithub(colaborador)).rejects.toThrow(/permiss/);
  });
});
