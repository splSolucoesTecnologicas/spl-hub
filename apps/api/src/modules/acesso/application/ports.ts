import type { AuditoriaProps, DesafioTotp, Sessao, SolicitacaoAcesso } from '../domain/sessao.js';
import type { Usuario } from '../domain/usuario.js';

export interface UsuarioRepository {
  salvar(usuario: Usuario): Promise<void>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  listar(params: { limite: number; cursor?: string }): Promise<{ itens: Usuario[]; proximoCursor: string | null }>;
  contarAdmins(): Promise<number>;
}

export interface SessaoRepository {
  salvar(sessao: Sessao): Promise<void>;
  buscarPorHash(tokenHash: string): Promise<Sessao | null>;
  revogar(tokenHash: string): Promise<void>;
}

export interface DesafioRepository {
  salvar(desafio: DesafioTotp): Promise<void>;
  buscar(id: string): Promise<DesafioTotp | null>;
  consumir(id: string): Promise<void>;
}

export interface SolicitacaoRepository {
  salvar(solicitacao: SolicitacaoAcesso): Promise<void>;
  buscarPorId(id: string): Promise<SolicitacaoAcesso | null>;
  listar(): Promise<SolicitacaoAcesso[]>;
}

export interface AuditoriaRepository {
  registrar(evento: AuditoriaProps): Promise<void>;
  listar(): Promise<AuditoriaProps[]>;
}

export interface Senhas {
  hash(senha: string): Promise<string>;
  confere(senha: string, hash: string): Promise<boolean>;
}

export interface TotpPort {
  gerarSegredo(): string;
  uri(email: string, segredo: string): string;
  confere(segredo: string, codigo: string, agora: Date): boolean;
}

export interface Tokens {
  novo(): string;
  hash(token: string): string;
}
