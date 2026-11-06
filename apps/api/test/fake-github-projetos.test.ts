import { describe, expect, it } from 'vitest';
import { FakeGitHubProjetos } from '../src/integrations/github/fake-github-projetos.js';

describe('FakeGitHubProjetos', () => {
  it('cria uma issue e define o status no board', async () => {
    const github = new FakeGitHubProjetos();
    const issue = await github.criarIssue({ owner: 'spl', repo: 'hub', titulo: 'Testar', corpo: '' });
    expect(issue.issueNumero).toBeGreaterThan(0);
    const item = await github.definirStatusNoProjeto({ owner: 'spl', repo: 'hub', numeroProjeto: 1, issueNodeId: issue.nodeId, itemNodeId: null, opcaoStatusId: 'opt-feito' });
    expect(item.itemNodeId).toContain(issue.nodeId);
    expect(github.opcaoDoItem(item.itemNodeId)).toBe('opt-feito');
  });

  it('lista as issues criadas junto com as que já existiam', async () => {
    const github = new FakeGitHubProjetos();
    github.semearIssueExistente('spl', 'hub', { numero: 3, titulo: 'Antiga', estado: 'closed' });
    await github.criarIssue({ owner: 'spl', repo: 'hub', titulo: 'Nova', corpo: '' });
    expect((await github.listarIssuesDoRepo('spl', 'hub')).map((issue) => issue.titulo)).toEqual(['Antiga', 'Nova']);
  });

  it('status() informa que não está conectado', async () => {
    const github = new FakeGitHubProjetos();
    expect(await github.status()).toEqual({ conectado: false, organizacao: null });
  });
});
