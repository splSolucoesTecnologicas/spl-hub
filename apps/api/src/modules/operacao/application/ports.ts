import type { Cliente } from '../domain/cliente.js';
import type { Projeto } from '../domain/projeto.js';
import type { Decisao, Objetivo } from '../domain/socios.js';

export interface ClienteRepository {
  salvar(cliente: Cliente): Promise<void>;
  buscarPorId(id: string): Promise<Cliente | null>;
  remover(id: string): Promise<void>;
  listar(params: { limite: number; cursor?: string }): Promise<{ itens: Cliente[]; proximoCursor: string | null }>;
}

export interface ProjetoRepository {
  salvar(projeto: Projeto): Promise<void>;
  buscarPorId(id: string): Promise<Projeto | null>;
  /** Compara sem diferenciar maiúsculas, como o GitHub faz com dono/nome. */
  buscarPorRepositorio(repositorio: string): Promise<Projeto | null>;
  remover(id: string): Promise<void>;
  listar(params: { limite: number; cursor?: string }): Promise<{ itens: Projeto[]; proximoCursor: string | null }>;
  listarTodos(): Promise<Projeto[]>;
}

/** Leitura do GitHub para montar o vínculo de um Projeto na tela de edição. */
export interface CatalogoGithub {
  listarRepositorios(): Promise<{ owner: string; nome: string }[]>;
  listarProjetosDoRepo(owner: string, repo: string): Promise<{ numero: number; titulo: string }[]>;
  listarOpcoesDeStatus(owner: string, repo: string, numeroProjeto: number): Promise<{ id: string; nome: string }[]>;
  status(): Promise<{ conectado: boolean; organizacao: string | null }>;
}

export interface DecisaoRepository {
  salvar(decisao: Decisao): Promise<void>;
  buscarPorId(id: string): Promise<Decisao | null>;
  remover(id: string): Promise<void>;
  listar(): Promise<Decisao[]>;
}

export interface ObjetivoRepository {
  salvar(objetivo: Objetivo): Promise<void>;
  buscarPorId(id: string): Promise<Objetivo | null>;
  remover(id: string): Promise<void>;
  listar(): Promise<Objetivo[]>;
}
