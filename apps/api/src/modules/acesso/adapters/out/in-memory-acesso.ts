import { paginar } from '../../../../shared/application/paginar.js';
import { DesafioTotp, Sessao, SolicitacaoAcesso, type AuditoriaProps } from '../../domain/sessao.js';
import { Usuario } from '../../domain/usuario.js';
import type { AuditoriaRepository, DesafioRepository, SessaoRepository, SolicitacaoRepository, UsuarioRepository } from '../../application/ports.js';

export class InMemoryUsuarioRepository implements UsuarioRepository {
  private dados = new Map<string, ReturnType<Usuario['toJSON']>>();
  async salvar(usuario: Usuario) { this.dados.set(usuario.id, usuario.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? Usuario.restaurar(props) : null; }
  async buscarPorEmail(email: string) {
    const props = [...this.dados.values()].find((item) => item.email === email.trim().toLowerCase());
    return props ? Usuario.restaurar(props) : null;
  }
  async listar({ limite, cursor }: { limite: number; cursor?: string }) {
    const pagina = paginar([...this.dados.values()], limite, cursor);
    return { itens: pagina.itens.map((item) => Usuario.restaurar(item)), proximoCursor: pagina.proximoCursor };
  }
  async contarAdmins() { return [...this.dados.values()].filter((item) => item.admin && item.ativo).length; }
  async remover(id: string) { this.dados.delete(id); }
}

export class InMemorySessaoRepository implements SessaoRepository {
  private dados = new Map<string, ReturnType<Sessao['toJSON']>>();
  async salvar(sessao: Sessao) { this.dados.set(sessao.tokenHash, sessao.toJSON()); }
  async buscarPorHash(tokenHash: string) { const props = this.dados.get(tokenHash); return props ? Sessao.restaurar(props) : null; }
  async revogar(tokenHash: string) { this.dados.delete(tokenHash); }
}

export class InMemoryDesafioRepository implements DesafioRepository {
  private dados = new Map<string, ReturnType<DesafioTotp['toJSON']>>();
  async salvar(desafio: DesafioTotp) { this.dados.set(desafio.id, desafio.toJSON()); }
  async buscar(id: string) { const props = this.dados.get(id); return props ? DesafioTotp.restaurar(props) : null; }
  async consumir(id: string) { this.dados.delete(id); }
}

export class InMemorySolicitacaoRepository implements SolicitacaoRepository {
  private dados = new Map<string, ReturnType<SolicitacaoAcesso['toJSON']>>();
  async salvar(solicitacao: SolicitacaoAcesso) { this.dados.set(solicitacao.id, solicitacao.toJSON()); }
  async buscarPorId(id: string) { const props = this.dados.get(id); return props ? SolicitacaoAcesso.restaurar(props) : null; }
  async listar() { return [...this.dados.values()].map((item) => SolicitacaoAcesso.restaurar(item)); }
}

export class InMemoryAuditoriaRepository implements AuditoriaRepository {
  private dados: AuditoriaProps[] = [];
  async registrar(evento: AuditoriaProps) { this.dados.push(evento); }
  async listar() { return [...this.dados].sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime()); }
}
