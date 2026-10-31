import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

export interface DecisaoProps {
  id: string;
  titulo: string;
  detalhe: string;
  quando: Date;
  autorId: string;
  criadoEm: Date;
}

export class Decisao {
  private constructor(private props: DecisaoProps) {}

  static criar(input: { id: string; titulo: string; detalhe?: string; quando: Date; autorId: string; agora: Date }): Decisao {
    const titulo = input.titulo.trim();
    if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
    return new Decisao({ id: input.id, titulo, detalhe: (input.detalhe ?? '').trim(), quando: input.quando, autorId: input.autorId, criadoEm: input.agora });
  }

  static restaurar(props: DecisaoProps): Decisao { return new Decisao({ ...props }); }

  atualizar(input: { titulo?: string; detalhe?: string; quando?: Date }): void {
    if (input.titulo !== undefined) {
      const titulo = input.titulo.trim();
      if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
      this.props.titulo = titulo;
    }
    if (input.detalhe !== undefined) this.props.detalhe = input.detalhe.trim();
    if (input.quando) this.props.quando = input.quando;
  }

  get id() { return this.props.id; }
  get titulo() { return this.props.titulo; }
  get detalhe() { return this.props.detalhe; }
  get quando() { return this.props.quando; }
  get autorId() { return this.props.autorId; }
  get criadoEm() { return this.props.criadoEm; }
  toJSON(): DecisaoProps { return { ...this.props }; }
}

export interface ObjetivoProps {
  id: string;
  titulo: string;
  progresso: number;
  periodo: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class Objetivo {
  private constructor(private props: ObjetivoProps) {}

  static criar(input: { id: string; titulo: string; progresso: number; periodo: string; agora: Date }): Objetivo {
    const objetivo = new Objetivo({ id: input.id, titulo: '', progresso: 0, periodo: '', criadoEm: input.agora, atualizadoEm: input.agora });
    objetivo.aplicar(input);
    return objetivo;
  }

  static restaurar(props: ObjetivoProps): Objetivo { return new Objetivo({ ...props }); }

  atualizar(input: Partial<Pick<ObjetivoProps, 'titulo' | 'progresso' | 'periodo'>>, agora: Date): void {
    this.aplicar({ ...this.props, ...input });
    this.props.atualizadoEm = agora;
  }

  private aplicar(input: { titulo: string; progresso: number; periodo: string }): void {
    const titulo = input.titulo.trim();
    const periodo = input.periodo.trim();
    if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
    if (periodo.length < 2 || periodo.length > 40) throw new ErroDeDominio('periodo_invalido', 'Informe o período, como Q4 2026');
    if (!Number.isInteger(input.progresso) || input.progresso < 0 || input.progresso > 100) throw new ErroDeDominio('progresso_invalido', 'Progresso fica entre 0 e 100');
    this.props.titulo = titulo;
    this.props.progresso = input.progresso;
    this.props.periodo = periodo;
  }

  get id() { return this.props.id; }
  get titulo() { return this.props.titulo; }
  get progresso() { return this.props.progresso; }
  get periodo() { return this.props.periodo; }
  get criadoEm() { return this.props.criadoEm; }
  get atualizadoEm() { return this.props.atualizadoEm; }
  toJSON(): ObjetivoProps { return { ...this.props }; }
}
