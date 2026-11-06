import { COLUNAS, type Coluna } from '../../../shared/domain/coluna.js';
import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

const REPOSITORIO = /^([\w.-]+)\/([\w.-]+)$/;

export interface BoardGithub {
  numero: number;
  mapa: Readonly<Record<Coluna, string>>;
}

export interface VinculoGithubInput {
  repositorio: string | null;
  githubProjectNumero: number | null;
  githubColunaMap: Record<string, string> | null;
}

/**
 * Ligação de um Projeto com o GitHub. O repositório basta para as issues irem e voltarem;
 * o board só conta quando tem número e as quatro colunas mapeadas.
 */
export class VinculoGithub {
  private constructor(readonly owner: string, readonly repo: string, readonly board: BoardGithub | null) {}

  static de(input: VinculoGithubInput): VinculoGithub | null {
    const partes = input.repositorio ? REPOSITORIO.exec(input.repositorio) : null;
    if (!partes) return null;
    const mapa = mapaDasColunas(input.githubColunaMap);
    const board = input.githubProjectNumero != null && mapa ? { numero: input.githubProjectNumero, mapa } : null;
    return new VinculoGithub(partes[1]!, partes[2]!, board);
  }

  static validar(input: VinculoGithubInput): void {
    if (input.repositorio && !REPOSITORIO.test(input.repositorio)) {
      throw new ErroDeDominio('repositorio_invalido', 'Repositório no formato dono/nome');
    }
    if (input.githubColunaMap != null && !mapaCompleto(input.githubColunaMap)) {
      throw new ErroDeDominio('mapeamento_incompleto', 'Mapeamento de colunas precisa cobrir a_fazer, fazendo, revisao e feito');
    }
  }

  get repositorio(): string {
    return `${this.owner}/${this.repo}`;
  }

  referencia(issueNumero: number): string {
    return `${this.repositorio}#${issueNumero}`;
  }

  colunaDaOpcao(opcaoStatusId: string, atual?: Coluna): Coluna | null {
    const board = this.board;
    if (!board) return null;
    // Duas colunas podem apontar para a mesma opção do board; nesse caso a tarefa fica onde está.
    if (atual && board.mapa[atual] === opcaoStatusId) return atual;
    return COLUNAS.find((coluna) => board.mapa[coluna] === opcaoStatusId) ?? null;
  }
}

function mapaCompleto(mapa: Record<string, string>): boolean {
  const cobreTodas = COLUNAS.every((coluna) => typeof mapa[coluna] === 'string' && mapa[coluna].length > 0);
  return cobreTodas && Object.keys(mapa).length === COLUNAS.length;
}

function mapaDasColunas(mapa: Record<string, string> | null): Record<Coluna, string> | null {
  if (!mapa || !mapaCompleto(mapa)) return null;
  return Object.fromEntries(COLUNAS.map((coluna) => [coluna, mapa[coluna]])) as Record<Coluna, string>;
}
