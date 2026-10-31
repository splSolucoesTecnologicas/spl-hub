import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

export interface NoticiaProps {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  corpo: string;
  publicada: boolean;
  publicadaEm: Date | null;
  autorNome: string;
  exemplo: boolean;
  criadaEm: Date;
}

export function slugificar(titulo: string): string {
  const base = titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return base || 'noticia';
}

export class Noticia {
  private constructor(private props: NoticiaProps) {}

  static criar(input: { id: string; slug: string; titulo: string; resumo: string; corpo: string; autorNome: string; exemplo?: boolean; agora: Date; publicar?: boolean }): Noticia {
    const titulo = input.titulo.trim();
    const resumo = input.resumo.trim();
    const corpo = input.corpo.trim();
    if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
    if (resumo.length < 3) throw new ErroDeDominio('resumo_curto', 'Resumo precisa de pelo menos 3 caracteres');
    if (corpo.length < 3) throw new ErroDeDominio('corpo_curto', 'Corpo precisa de pelo menos 3 caracteres');
    const publicar = input.publicar ?? false;
    return new Noticia({
      id: input.id, slug: input.slug, titulo, resumo, corpo, autorNome: input.autorNome.trim(),
      publicada: publicar, publicadaEm: publicar ? input.agora : null, exemplo: input.exemplo ?? false, criadaEm: input.agora,
    });
  }

  static restaurar(props: NoticiaProps): Noticia { return new Noticia({ ...props }); }

  publicar(agora: Date): void {
    this.props.publicada = true;
    this.props.publicadaEm ??= agora;
  }

  despublicar(): void { this.props.publicada = false; }

  editar(input: { titulo?: string; resumo?: string; corpo?: string }): void {
    if (input.titulo !== undefined) {
      const titulo = input.titulo.trim();
      if (titulo.length < 3) throw new ErroDeDominio('titulo_curto', 'Título precisa de pelo menos 3 caracteres');
      this.props.titulo = titulo;
    }
    if (input.resumo !== undefined) {
      const resumo = input.resumo.trim();
      if (resumo.length < 3) throw new ErroDeDominio('resumo_curto', 'Resumo precisa de pelo menos 3 caracteres');
      this.props.resumo = resumo;
    }
    if (input.corpo !== undefined) {
      const corpo = input.corpo.trim();
      if (corpo.length < 3) throw new ErroDeDominio('corpo_curto', 'Corpo precisa de pelo menos 3 caracteres');
      this.props.corpo = corpo;
    }
  }

  get id() { return this.props.id; }
  get slug() { return this.props.slug; }
  get titulo() { return this.props.titulo; }
  get resumo() { return this.props.resumo; }
  get corpo() { return this.props.corpo; }
  get publicada() { return this.props.publicada; }
  get publicadaEm() { return this.props.publicadaEm; }
  get autorNome() { return this.props.autorNome; }
  get exemplo() { return this.props.exemplo; }
  get criadaEm() { return this.props.criadaEm; }
  toJSON(): NoticiaProps { return { ...this.props }; }
}
