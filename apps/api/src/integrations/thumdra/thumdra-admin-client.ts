import type { ThumdraUsuarioAdmin } from '@spl/contracts';

export interface Pagina<T> { data: T[]; nextCursor: string | null }

/** Porta de saída: a API administrativa da Thumdra (/admin/v1). O hub nunca lê o banco do produto. */
export interface ThumdraAdminClient {
  listarUsuarios(params: { cursor?: string; limite?: number }, ator: string): Promise<Pagina<ThumdraUsuarioAdmin>>;
  desativarUsuario(id: string, ator: string, idempotencyKey: string): Promise<void>;
}
