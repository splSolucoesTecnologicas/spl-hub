import type { PrismaClient } from '@prisma/client';
import { Tarefa, type Coluna, type Produto, type TarefaProps } from '../../domain/tarefa.js';
import type { TarefaRepository } from '../../application/ports/tarefa-repository.js';

function de(row: TarefaProps): Tarefa { return Tarefa.restaurar(row); }

export class PrismaTarefaRepository implements TarefaRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(tarefa: Tarefa) {
    const dados = tarefa.toJSON();
    await this.db.tarefa.upsert({ where: { id: dados.id }, create: dados, update: { ...dados, id: undefined } });
  }
  async buscarPorId(id: string) { const row = await this.db.tarefa.findUnique({ where: { id } }); return row ? de(row as TarefaProps) : null; }
  async remover(id: string) { await this.db.tarefa.deleteMany({ where: { id } }); }
  async listarTodas() { const rows = await this.db.tarefa.findMany(); return rows.map((row) => de(row as TarefaProps)); }
  async listar({ limite, cursor, coluna, responsavelId, produto }: { limite: number; cursor?: string; coluna?: Coluna; responsavelId?: string; produto?: Produto }) {
    const rows = await this.db.tarefa.findMany({
      where: { ...(coluna ? { coluna } : {}), ...(responsavelId ? { responsavelId } : {}), ...(produto ? { produto } : {}) },
      take: limite + 1, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const temMais = rows.length > limite;
    const itens = rows.slice(0, limite).map((row) => de(row as TarefaProps));
    return { itens, proximoCursor: temMais ? itens[itens.length - 1]!.id : null };
  }
}
