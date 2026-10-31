import type { ThumdraUsuarioAdmin } from '@spl/contracts';
import type { Pagina, ThumdraAdminClient } from './thumdra-admin-client.js';

/** Implementação em memória para dev local e testes. */
export class FakeThumdraAdminClient implements ThumdraAdminClient {
  readonly auditoria: { acao: string; ator: string; alvo: string }[] = [];
  private chavesUsadas = new Set<string>();
  constructor(private usuarios: ThumdraUsuarioAdmin[] = [
    { id: 'u1', email: 'ana@exemplo.com', plano: 'pro', ativo: true },
    { id: 'u2', email: 'bruno@exemplo.com', plano: 'free', ativo: true },
  ]) {}

  async listarUsuarios({ cursor, limite = 20 }: { cursor?: string; limite?: number }): Promise<Pagina<ThumdraUsuarioAdmin>> {
    const i = cursor ? this.usuarios.findIndex((usuario) => usuario.id === cursor) + 1 : 0;
    const data = this.usuarios.slice(i, i + limite);
    return { data, nextCursor: i + limite < this.usuarios.length ? data[data.length - 1]!.id : null };
  }

  async desativarUsuario(id: string, ator: string, idempotencyKey: string) {
    if (this.chavesUsadas.has(idempotencyKey)) return;
    this.chavesUsadas.add(idempotencyKey);
    const usuario = this.usuarios.find((item) => item.id === id);
    if (!usuario) throw new Error(`Usuário ${id} não existe`);
    usuario.ativo = false;
    this.auditoria.push({ acao: 'desativar_usuario', ator, alvo: id });
  }
}
