import { ThumdraUsuarioAdminSchema, pagina } from '@spl/contracts';
import type { ThumdraAdminClient } from './thumdra-admin-client.js';

/** Adapter real: OAuth2 client credentials + escopos admin + header X-Actor. */
export class HttpThumdraAdminClient implements ThumdraAdminClient {
  private token?: { valor: string; expiraEm: number };
  constructor(private cfg: { baseUrl: string; clientId: string; clientSecret: string; scopes: string }) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiraEm > Date.now() + 30_000) return this.token.valor;
    const res = await fetch(`${this.cfg.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, scope: this.cfg.scopes }),
    });
    if (!res.ok) throw new Error(`Falha ao autenticar na Thumdra: ${res.status}`);
    const corpo = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { valor: corpo.access_token, expiraEm: Date.now() + corpo.expires_in * 1000 };
    return corpo.access_token;
  }

  private async req(path: string, ator: string, init: RequestInit = {}) {
    const res = await fetch(`${this.cfg.baseUrl}/admin/v1${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${await this.accessToken()}`, 'x-actor': ator },
    });
    if (!res.ok) throw new Error(`Thumdra /admin/v1${path} -> ${res.status}: ${await res.text()}`);
    return res;
  }

  async listarUsuarios({ cursor, limite = 20 }: { cursor?: string; limite?: number }, ator: string) {
    const consulta = new URLSearchParams({ limit: String(limite), ...(cursor ? { cursor } : {}) });
    const res = await this.req(`/usuarios?${consulta}`, ator);
    return pagina(ThumdraUsuarioAdminSchema).parse(await res.json());
  }

  async desativarUsuario(id: string, ator: string, idempotencyKey: string) {
    await this.req(`/usuarios/${id}/desativar`, ator, { method: 'POST', headers: { 'idempotency-key': idempotencyKey } });
  }
}
