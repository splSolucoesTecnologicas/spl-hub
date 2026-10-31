import { paginar } from '../../../../shared/application/paginar.js';
import type { NoticiaRepository } from '../../application/use-cases.js';
import { Noticia } from '../../domain/noticia.js';

export class InMemoryNoticiaRepository implements NoticiaRepository {
  private dados = new Map<string, ReturnType<Noticia['toJSON']>>();
  async salvar(noticia: Noticia) { this.dados.set(noticia.id, noticia.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Noticia.restaurar(props) : null; }
  async buscarPorSlug(slug: string) {
    const props = [...this.dados.values()].find((item) => item.slug === slug);
    return props ? Noticia.restaurar(props) : null;
  }
  async listar({ limite, cursor, somentePublicadas }: { limite: number; cursor?: string; somentePublicadas: boolean }) {
    const filtradas = [...this.dados.values()].filter((item) => (somentePublicadas ? item.publicada : true));
    const pagina = paginar(filtradas, limite, cursor);
    return { itens: pagina.itens.map((item) => Noticia.restaurar(item)), proximoCursor: pagina.proximoCursor };
  }
}
