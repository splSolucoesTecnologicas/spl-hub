import type { TarefaDTO } from '@spl/contracts';

export type ColunaTarefa = TarefaDTO['coluna'];

export const COLUNAS: readonly { id: ColunaTarefa; nome: string }[] = [
  { id: 'a_fazer', nome: 'A fazer' },
  { id: 'fazendo', nome: 'Fazendo' },
  { id: 'revisao', nome: 'Revisão' },
  { id: 'feito', nome: 'Feito' },
];

export function nomeDaColuna(id: ColunaTarefa): string {
  return COLUNAS.find((coluna) => coluna.id === id)?.nome ?? id;
}

/** O board só sincroniza com as quatro colunas mapeadas; a API recusa mapeamento parcial. */
export function mapaDeColunasCompleto(mapa: Record<string, string>): boolean {
  return COLUNAS.every((coluna) => Boolean(mapa[coluna.id]));
}
