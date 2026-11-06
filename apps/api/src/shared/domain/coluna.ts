/** Colunas do quadro de Tarefas. O vínculo do Projeto com o board do GitHub mapeia cada uma delas. */
export const COLUNAS = ['a_fazer', 'fazendo', 'revisao', 'feito'] as const;
export type Coluna = (typeof COLUNAS)[number];
