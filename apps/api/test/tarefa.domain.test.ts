import { describe, expect, it } from 'vitest';
import { ErroDeDominio } from '../src/shared/domain/erro-de-dominio.js';
import { Tarefa } from '../src/modules/tarefas/domain/tarefa.js';

const agora = new Date('2026-10-30T15:00:00.000Z');

describe('Tarefa (domínio)', () => {
  it('nasce em A fazer e marca atraso fora de Feito', () => {
    const tarefa = Tarefa.criar({ id: '1', titulo: '  Revisar API  ', agora, prazo: new Date('2026-10-28T15:00:00.000Z') });
    expect(tarefa.titulo).toBe('Revisar API');
    expect(tarefa.coluna).toBe('a_fazer');
    expect(tarefa.estaAtrasada(agora)).toBe(true);
    tarefa.atualizar({ coluna: 'feito' }, agora);
    expect(tarefa.estaAtrasada(agora)).toBe(false);
  });

  it('rejeita título curto e coluna inválida', () => {
    expect(() => Tarefa.criar({ id: '1', titulo: 'ab', agora })).toThrow(ErroDeDominio);
    const tarefa = Tarefa.criar({ id: '1', titulo: 'Proxy', agora });
    expect(() => tarefa.atualizar({ coluna: 'arquivada' as 'feito' }, agora)).toThrow(/Coluna/);
  });

  it('vincula a tarefa a uma issue do GitHub', () => {
    const tarefa = Tarefa.criar({ id: '1', titulo: 'Testar vinculo', agora });
    tarefa.vincularGithub(42, 'IT_issue', 'PVTI_item');
    expect(tarefa.githubIssueNumero).toBe(42);
    expect(tarefa.githubItemNodeId).toBe('PVTI_item');
  });

  it('separa minhas e de olho', () => {
    const tarefa = Tarefa.criar({ id: '1', titulo: 'Proxy', agora, responsavelId: 'edu', observadorIds: ['segatto'] });
    expect(tarefa.visivelPara('edu', 'minhas')).toBe(true);
    expect(tarefa.visivelPara('segatto', 'de_olho')).toBe(true);
    expect(tarefa.visivelPara('segatto', 'minhas')).toBe(false);
  });
});
