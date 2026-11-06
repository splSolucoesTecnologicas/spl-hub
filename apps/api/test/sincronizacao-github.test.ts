import { describe, expect, it, vi } from 'vitest';
import { criarSincronizacaoGithub, marcadorDaTarefa } from '../src/modules/tarefas/application/sincronizacao-github.js';
import { InMemoryTarefaRepository } from '../src/modules/tarefas/adapters/out/in-memory-tarefa-repository.js';
import { InMemoryProjetoRepository } from '../src/modules/operacao/adapters/out/memoria.js';
import { FakeGitHubProjetos } from '../src/integrations/github/fake-github-projetos.js';
import { Projeto } from '../src/modules/operacao/domain/projeto.js';
import { Tarefa, type Coluna } from '../src/modules/tarefas/domain/tarefa.js';

const AGORA = new Date('2026-11-06T12:00:00.000Z');
const MAPA = { a_fazer: 'opt-a-fazer', fazendo: 'opt-fazendo', revisao: 'opt-revisao', feito: 'opt-feito' };

interface ProjetoDeTeste { repositorio?: string; mapa?: Record<string, string> | null }

async function montar(projeto: ProjetoDeTeste = {}) {
  const tarefas = new InMemoryTarefaRepository();
  const projetos = new InMemoryProjetoRepository();
  const github = new FakeGitHubProjetos();
  let n = 0;
  const sync = criarSincronizacaoGithub({
    tarefas, projetos, github, relogio: { agora: () => AGORA }, ids: { novo: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` },
  });
  const mapa = projeto.mapa === undefined ? MAPA : projeto.mapa;
  await projetos.salvar(Projeto.criar({
    id: 'proj1', nome: 'Com GitHub', tipo: 'produto', status: 'piloto', cor: '#4c8dff', agora: AGORA,
    repositorio: projeto.repositorio ?? 'spl/teste', githubProjectNumero: mapa ? 1 : null, githubColunaMap: mapa,
  }));
  async function tarefa(titulo: string, opcoes: { coluna?: Coluna; id?: string; projetoId?: string | null; issue?: number; item?: string } = {}) {
    const nova = Tarefa.criar({ id: opcoes.id ?? 'tarefa-1', titulo, agora: AGORA, coluna: opcoes.coluna, projetoId: opcoes.projetoId === undefined ? 'proj1' : opcoes.projetoId });
    if (opcoes.issue != null) nova.vincularGithub({ issueNumero: opcoes.issue, referencia: `spl/teste#${opcoes.issue}`, itemNodeId: opcoes.item ?? null });
    await tarefas.salvar(nova);
    return nova;
  }
  return { tarefas, github, sync, tarefa };
}

describe('Sincronização com GitHub: saída', () => {
  it('cria a issue com o marcador, põe no board e guarda a referência', async () => {
    const { tarefas, github, sync, tarefa } = await montar();
    expect(await sync.enviar(await tarefa('Linkar com GitHub'))).toBe(true);
    const salva = await tarefas.buscarPorId('tarefa-1');
    expect(salva?.githubIssueNumero).toBe(401);
    expect(salva?.referencia).toBe('spl/teste#401');
    expect(salva?.sincronizadaEm).toEqual(AGORA);
    expect(github.issues('spl', 'teste')[0]?.corpo).toContain(marcadorDaTarefa('tarefa-1'));
    expect(github.opcaoDoItem(salva!.githubItemNodeId!)).toBe('opt-a-fazer');
  });

  it('tarefa criada já em feito abre a issue fechada', async () => {
    const { github, sync, tarefa } = await montar();
    await sync.enviar(await tarefa('Já resolvida', { coluna: 'feito' }));
    expect(github.issues('spl', 'teste')[0]?.estado).toBe('closed');
  });

  it('mover de coluna atualiza a mesma issue e o status no board', async () => {
    const { tarefas, github, sync, tarefa } = await montar();
    await sync.enviar(await tarefa('Mover depois'));
    const salva = (await tarefas.buscarPorId('tarefa-1'))!;
    salva.atualizar({ coluna: 'revisao' }, AGORA);
    await sync.enviar(salva);
    expect(github.issues('spl', 'teste')).toHaveLength(1);
    expect(github.opcaoDoItem(salva.githubItemNodeId!)).toBe('opt-revisao');
  });

  it('projeto sem board mapeado não envia nada', async () => {
    const { github, sync, tarefa } = await montar({ mapa: null });
    expect(await sync.enviar(await tarefa('Sem board'))).toBe(false);
    expect(github.issues('spl', 'teste')).toHaveLength(0);
  });

  it('falha no board depois de criar a issue não abre uma segunda issue', async () => {
    const { tarefas, github, sync, tarefa } = await montar();
    vi.spyOn(github, 'definirStatusNoProjeto').mockRejectedValueOnce(new Error('GraphQL fora do ar'));
    await expect(sync.enviar(await tarefa('Rede instável'))).rejects.toThrow('GraphQL fora do ar');
    const salva = (await tarefas.buscarPorId('tarefa-1'))!;
    expect(salva.githubIssueNumero).toBe(401);
    expect(await sync.enviar(salva)).toBe(true);
    expect(github.issues('spl', 'teste')).toHaveLength(1);
  });

  it('ressincroniza só as tarefas de projeto com board', async () => {
    const { sync, tarefa } = await montar();
    await tarefa('No projeto');
    await tarefa('Solta', { id: 'tarefa-2', projetoId: null });
    expect(await sync.ressincronizar()).toEqual({ modo: 'fake', enviadas: 1, semBoard: 1, falhas: 0 });
  });
});

describe('Sincronização com GitHub: entrada', () => {
  it('issue aberta no GitHub vira tarefa, sem diferenciar maiúsculas no repositório', async () => {
    const { tarefas, sync } = await montar({ repositorio: 'SPL/Teste', mapa: null });
    await sync.aplicarEvento({ tipo: 'issue', acao: 'opened', repositorio: 'spl/teste', numero: 7, titulo: 'Bug achado', estado: 'open', corpo: null });
    const [criada] = await tarefas.listarTodas();
    expect(criada?.githubIssueNumero).toBe(7);
    expect(criada?.referencia).toBe('SPL/Teste#7');
    expect(criada?.coluna).toBe('a_fazer');
  });

  it('o webhook da issue que o Hub acabou de criar não duplica a tarefa', async () => {
    const { tarefas, sync, tarefa } = await montar();
    await tarefa('Criada no Hub');
    await sync.aplicarEvento({ tipo: 'issue', acao: 'opened', repositorio: 'spl/teste', numero: 401, titulo: 'Criada no Hub', estado: 'open', corpo: marcadorDaTarefa('tarefa-1') });
    const todas = await tarefas.listarTodas();
    expect(todas).toHaveLength(1);
    expect(todas[0]?.githubIssueNumero).toBe(401);
  });

  it('fechar e reabrir a issue leva a tarefa para feito e de volta para a fazer', async () => {
    const { tarefas, sync, tarefa } = await montar();
    await tarefa('Em revisão', { coluna: 'revisao', issue: 7 });
    const evento = { tipo: 'issue', repositorio: 'spl/teste', numero: 7, titulo: 'Em revisão', corpo: null } as const;
    await sync.aplicarEvento({ ...evento, acao: 'edited', estado: 'open' });
    expect((await tarefas.buscarPorId('tarefa-1'))?.coluna).toBe('revisao');
    await sync.aplicarEvento({ ...evento, acao: 'closed', estado: 'closed' });
    expect((await tarefas.buscarPorId('tarefa-1'))?.coluna).toBe('feito');
    await sync.aplicarEvento({ ...evento, acao: 'reopened', estado: 'open' });
    expect((await tarefas.buscarPorId('tarefa-1'))?.coluna).toBe('a_fazer');
  });

  it('mudança de status no board move a tarefa pela busca reversa do mapa', async () => {
    const { tarefas, sync, tarefa } = await montar();
    await tarefa('No board', { issue: 7, item: 'PVTI_1' });
    await sync.aplicarEvento({ tipo: 'item_do_board', itemNodeId: 'PVTI_1', opcaoStatusId: 'opt-revisao' });
    expect((await tarefas.buscarPorId('tarefa-1'))?.coluna).toBe('revisao');
  });

  it('opção ligada a duas colunas mantém a tarefa onde já está', async () => {
    const { tarefas, sync, tarefa } = await montar({ mapa: { ...MAPA, fazendo: 'opt-andamento', revisao: 'opt-andamento' } });
    await tarefa('Em revisão', { coluna: 'revisao', issue: 7, item: 'PVTI_1' });
    await tarefa('A fazer', { id: 'tarefa-2', issue: 8, item: 'PVTI_2' });
    await sync.aplicarEvento({ tipo: 'item_do_board', itemNodeId: 'PVTI_1', opcaoStatusId: 'opt-andamento' });
    await sync.aplicarEvento({ tipo: 'item_do_board', itemNodeId: 'PVTI_2', opcaoStatusId: 'opt-andamento' });
    expect((await tarefas.buscarPorId('tarefa-1'))?.coluna).toBe('revisao');
    expect((await tarefas.buscarPorId('tarefa-2'))?.coluna).toBe('fazendo');
  });

  it('ignora eventos de repositório sem projeto vinculado', async () => {
    const { tarefas, sync } = await montar();
    await sync.aplicarEvento({ tipo: 'issue', acao: 'opened', repositorio: 'outro/repo', numero: 1, titulo: 'Alheia', estado: 'open', corpo: null });
    expect(await tarefas.listarTodas()).toHaveLength(0);
  });
});

describe('Sincronização com GitHub: importação', () => {
  it('pula a issue que não vira tarefa válida e importa o resto', async () => {
    const { github, sync } = await montar();
    github.semearIssueExistente('spl', 'teste', { numero: 1, titulo: 'ok', estado: 'open' });
    github.semearIssueExistente('spl', 'teste', { numero: 2, titulo: 'Bug antigo', estado: 'closed' });
    expect(await sync.importarIssues('proj1')).toEqual({ importadas: 1, total: 2 });
  });
});
