import { paginar } from '../../../../shared/application/paginar.js';
import type { ClienteRepository, DecisaoRepository, ObjetivoRepository, ProjetoRepository } from '../../application/ports.js';
import { Cliente } from '../../domain/cliente.js';
import { Projeto } from '../../domain/projeto.js';
import { Decisao, Objetivo } from '../../domain/socios.js';

export class InMemoryClienteRepository implements ClienteRepository {
  private dados = new Map<string, ReturnType<Cliente['toJSON']>>();
  async salvar(cliente: Cliente) { this.dados.set(cliente.id, cliente.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Cliente.restaurar(props) : null; }
  async remover(id: string) { this.dados.delete(id); }
  async listar({ limite, cursor }: { limite: number; cursor?: string }) {
    const pagina = paginar([...this.dados.values()], limite, cursor);
    return { itens: pagina.itens.map((item) => Cliente.restaurar(item)), proximoCursor: pagina.proximoCursor };
  }
}

export class InMemoryProjetoRepository implements ProjetoRepository {
  private dados = new Map<string, ReturnType<Projeto['toJSON']>>();
  async salvar(projeto: Projeto) { this.dados.set(projeto.id, projeto.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Projeto.restaurar(props) : null; }
  async remover(id: string) { this.dados.delete(id); }
  async listar({ limite, cursor }: { limite: number; cursor?: string }) {
    const pagina = paginar([...this.dados.values()], limite, cursor);
    return { itens: pagina.itens.map((item) => Projeto.restaurar(item)), proximoCursor: pagina.proximoCursor };
  }
  async listarTodos() { return [...this.dados.values()].map((item) => Projeto.restaurar(item)); }
}

export class InMemoryDecisaoRepository implements DecisaoRepository {
  private dados = new Map<string, ReturnType<Decisao['toJSON']>>();
  async salvar(decisao: Decisao) { this.dados.set(decisao.id, decisao.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Decisao.restaurar(props) : null; }
  async remover(id: string) { this.dados.delete(id); }
  async listar() { return [...this.dados.values()].map((item) => Decisao.restaurar(item)); }
}

export class InMemoryObjetivoRepository implements ObjetivoRepository {
  private dados = new Map<string, ReturnType<Objetivo['toJSON']>>();
  async salvar(objetivo: Objetivo) { this.dados.set(objetivo.id, objetivo.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Objetivo.restaurar(props) : null; }
  async remover(id: string) { this.dados.delete(id); }
  async listar() { return [...this.dados.values()].map((item) => Objetivo.restaurar(item)); }
}
