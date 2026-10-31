import { describe, expect, it } from 'vitest';
import { FakeGitHubProjetos } from '../src/modules/tarefas/adapters/out/fake-github-projetos.js';

describe('FakeGitHubProjetos', () => {
  it('cria uma issue e define o status no board', async () => {
    const github = new FakeGitHubProjetos();
    const issue = await github.criarOuAtualizarIssue({ owner: 'spl', repo: 'hub', issueNumero: null, titulo: 'Testar', estado: 'open' });
    expect(issue.issueNumero).toBeGreaterThan(0);
    const item = await github.definirStatusNoProjeto({ owner: 'spl', repo: 'hub', numeroProjeto: 1, issueNodeId: issue.nodeId, itemNodeId: null, opcaoStatusId: 'opt-feito' });
    expect(item.itemNodeId).toContain(issue.nodeId);
  });

  it('status() informa que não está conectado', async () => {
    const github = new FakeGitHubProjetos();
    expect(await github.status()).toEqual({ conectado: false, organizacao: null });
  });
});
