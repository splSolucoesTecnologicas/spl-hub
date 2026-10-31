import type { PrismaClient } from '@prisma/client';
import type { NoticiaRepository } from '../../application/use-cases.js';
import { Noticia, type NoticiaProps } from '../../domain/noticia.js';

export class PrismaNoticiaRepository implements NoticiaRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(noticia: Noticia) {
    const dados = noticia.toJSON();
    await this.db.noticia.upsert({ where: { id: dados.id }, create: dados, update: { ...dados, id: undefined } });
  }
  async buscarPorId(id: string) { const row = await this.db.noticia.findUnique({ where: { id } }); return row ? Noticia.restaurar(row) : null; }
  async buscarPorSlug(slug: string) { const row = await this.db.noticia.findUnique({ where: { slug } }); return row ? Noticia.restaurar(row) : null; }
  async listar({ limite, cursor, somentePublicadas }: { limite: number; cursor?: string; somentePublicadas: boolean }) {
    const rows = await this.db.noticia.findMany({
      where: somentePublicadas ? { publicada: true } : {},
      take: limite + 1, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const temMais = rows.length > limite;
    const itens = rows.slice(0, limite).map((row) => Noticia.restaurar(row as NoticiaProps));
    return { itens, proximoCursor: temMais ? itens[itens.length - 1]!.id : null };
  }
  async remover(id: string) { await this.db.noticia.deleteMany({ where: { id } }); }
}
