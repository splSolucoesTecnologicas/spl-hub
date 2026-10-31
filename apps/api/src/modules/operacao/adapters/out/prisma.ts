import type { Prisma, PrismaClient } from '@prisma/client';
import type { ClienteRepository, DecisaoRepository, ObjetivoRepository, ProjetoRepository } from '../../application/ports.js';
import { Cliente, type ClienteProps } from '../../domain/cliente.js';
import { Projeto, type ProjetoProps } from '../../domain/projeto.js';
import { Decisao, Objetivo, type DecisaoProps, type ObjetivoProps } from '../../domain/socios.js';

export class PrismaClienteRepository implements ClienteRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(cliente: Cliente) {
    const dados = cliente.toJSON();
    await this.db.cliente.upsert({ where: { id: dados.id }, create: dados, update: { ...dados, id: undefined } });
  }
  async buscarPorId(id: string) { const row = await this.db.cliente.findUnique({ where: { id } }); return row ? Cliente.restaurar(row) : null; }
  async remover(id: string) { await this.db.cliente.deleteMany({ where: { id } }); }
  async listar({ limite, cursor }: { limite: number; cursor?: string }) {
    const rows = await this.db.cliente.findMany({ take: limite + 1, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const temMais = rows.length > limite;
    const itens = rows.slice(0, limite).map((row) => Cliente.restaurar(row as ClienteProps));
    return { itens, proximoCursor: temMais ? itens[itens.length - 1]!.id : null };
  }
}

export class PrismaProjetoRepository implements ProjetoRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(projeto: Projeto) {
    const { id, responsaveis, marcos, ...resto } = projeto.toJSON();
    const dados = { ...resto, responsaveis: responsaveis as unknown as Prisma.InputJsonValue, marcos: marcos as unknown as Prisma.InputJsonValue };
    await this.db.projeto.upsert({ where: { id }, create: { id, ...dados }, update: dados });
  }
  async buscarPorId(id: string) { const row = await this.db.projeto.findUnique({ where: { id } }); return row ? Projeto.restaurar(row as unknown as ProjetoProps) : null; }
  async remover(id: string) { await this.db.projeto.deleteMany({ where: { id } }); }
  async listar({ limite, cursor }: { limite: number; cursor?: string }) {
    const rows = await this.db.projeto.findMany({ take: limite + 1, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const temMais = rows.length > limite;
    const itens = rows.slice(0, limite).map((row) => Projeto.restaurar(row as unknown as ProjetoProps));
    return { itens, proximoCursor: temMais ? itens[itens.length - 1]!.id : null };
  }
  async listarTodos() {
    const rows = await this.db.projeto.findMany();
    return rows.map((row) => Projeto.restaurar(row as unknown as ProjetoProps));
  }
}

export class PrismaDecisaoRepository implements DecisaoRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(decisao: Decisao) {
    const dados = decisao.toJSON();
    await this.db.decisao.upsert({ where: { id: dados.id }, create: dados, update: { ...dados, id: undefined } });
  }
  async buscarPorId(id: string) { const row = await this.db.decisao.findUnique({ where: { id } }); return row ? Decisao.restaurar(row) : null; }
  async remover(id: string) { await this.db.decisao.deleteMany({ where: { id } }); }
  async listar() { return (await this.db.decisao.findMany()).map((row) => Decisao.restaurar(row as DecisaoProps)); }
}

export class PrismaObjetivoRepository implements ObjetivoRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(objetivo: Objetivo) {
    const dados = objetivo.toJSON();
    await this.db.objetivo.upsert({ where: { id: dados.id }, create: dados, update: { ...dados, id: undefined } });
  }
  async buscarPorId(id: string) { const row = await this.db.objetivo.findUnique({ where: { id } }); return row ? Objetivo.restaurar(row) : null; }
  async remover(id: string) { await this.db.objetivo.deleteMany({ where: { id } }); }
  async listar() { return (await this.db.objetivo.findMany()).map((row) => Objetivo.restaurar(row as ObjetivoProps)); }
}
