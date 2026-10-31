import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

export const COLUNAS = ['a_fazer', 'fazendo', 'revisao', 'feito'] as const;
export type Coluna = (typeof COLUNAS)[number];
export const PRODUTOS = ['thumdra', 'corujuris', 'spl', 'hub', 'infra', 'sob_medida'] as const;
export type Produto = (typeof PRODUTOS)[number];

export interface TarefaProps {
  id: string;
  titulo: string;
  coluna: Coluna;
  produto: Produto;
  responsavelId: string | null;
  observadorIds: string[];
  referencia: string | null;
  pullRequest: string | null;
  prazo: Date | null;
  exemplo: boolean;
  sincronizadaEm: Date | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export class Tarefa {
  private constructor(private props: TarefaProps) {}

  static criar(input: {
    id: string; titulo: string; agora: Date; coluna?: Coluna; produto?: Produto; responsavelId?: string | null;
    observadorIds?: string[]; referencia?: string | null; pullRequest?: string | null; prazo?: Date | null; exemplo?: boolean;
  }): Tarefa {
    const titulo = input.titulo.trim();
    if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
    const coluna = input.coluna ?? 'a_fazer';
    const produto = input.produto ?? 'hub';
    if (!COLUNAS.includes(coluna)) throw new ErroDeDominio('coluna_invalida', 'Coluna inválida');
    if (!PRODUTOS.includes(produto)) throw new ErroDeDominio('produto_invalido', 'Produto inválido');
    return new Tarefa({
      id: input.id, titulo, coluna, produto,
      responsavelId: input.responsavelId ?? null,
      observadorIds: input.observadorIds ?? [],
      referencia: input.referencia ?? null,
      pullRequest: input.pullRequest ?? null,
      prazo: input.prazo ?? null,
      exemplo: input.exemplo ?? false,
      sincronizadaEm: null,
      criadaEm: input.agora,
      atualizadaEm: input.agora,
    });
  }

  static restaurar(props: TarefaProps): Tarefa {
    return new Tarefa({ ...props, observadorIds: [...props.observadorIds] });
  }

  atualizar(input: Partial<Pick<TarefaProps, 'titulo' | 'coluna' | 'produto' | 'responsavelId' | 'observadorIds' | 'referencia' | 'pullRequest' | 'prazo'>>, agora: Date): void {
    if (input.titulo !== undefined) {
      const titulo = input.titulo.trim();
      if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
      this.props.titulo = titulo;
    }
    if (input.coluna !== undefined) {
      if (!COLUNAS.includes(input.coluna)) throw new ErroDeDominio('coluna_invalida', 'Coluna inválida');
      this.props.coluna = input.coluna;
    }
    if (input.produto !== undefined) {
      if (!PRODUTOS.includes(input.produto)) throw new ErroDeDominio('produto_invalido', 'Produto inválido');
      this.props.produto = input.produto;
    }
    if (input.responsavelId !== undefined) this.props.responsavelId = input.responsavelId;
    if (input.observadorIds !== undefined) this.props.observadorIds = [...input.observadorIds];
    if (input.referencia !== undefined) this.props.referencia = input.referencia;
    if (input.pullRequest !== undefined) this.props.pullRequest = input.pullRequest;
    if (input.prazo !== undefined) this.props.prazo = input.prazo;
    this.props.atualizadaEm = agora;
  }

  marcarSincronizada(referencia: string | null, agora: Date): void {
    if (referencia) this.props.referencia = referencia;
    this.props.sincronizadaEm = agora;
  }

  estaAtrasada(agora: Date): boolean {
    return Boolean(this.props.prazo && this.props.prazo.getTime() < agora.getTime() && this.props.coluna !== 'feito');
  }

  visivelPara(usuarioId: string, filtro: 'minhas' | 'de_olho' | 'todas'): boolean {
    if (filtro === 'todas') return true;
    if (filtro === 'minhas') return this.props.responsavelId === usuarioId;
    return this.props.observadorIds.includes(usuarioId) && this.props.responsavelId !== usuarioId;
  }

  get id() { return this.props.id; }
  get titulo() { return this.props.titulo; }
  get coluna() { return this.props.coluna; }
  get produto() { return this.props.produto; }
  get responsavelId() { return this.props.responsavelId; }
  get observadorIds() { return this.props.observadorIds; }
  get referencia() { return this.props.referencia; }
  get pullRequest() { return this.props.pullRequest; }
  get prazo() { return this.props.prazo; }
  get exemplo() { return this.props.exemplo; }
  get sincronizadaEm() { return this.props.sincronizadaEm; }
  get criadaEm() { return this.props.criadaEm; }
  get atualizadaEm() { return this.props.atualizadaEm; }
  toJSON(): TarefaProps { return { ...this.props, observadorIds: [...this.props.observadorIds] }; }
}
