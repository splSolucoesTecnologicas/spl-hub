import { createSign } from 'node:crypto';

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

/** JWT do App (RS256), válido por 10 minutos — usado só pra trocar por um token de instalação. */
export function gerarJwtApp(appId: string, chavePrivadaPem: string, agoraSegundos: number): string {
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64url(JSON.stringify({ iat: agoraSegundos - 30, exp: agoraSegundos + 600, iss: appId }));
  const dados = `${cabecalho}.${corpo}`;
  const assinatura = createSign('RSA-SHA256').update(dados).sign(chavePrivadaPem, 'base64url');
  return `${dados}.${assinatura}`;
}

export interface ConfigGithubApp {
  appId: string;
  chavePrivada: string;
  installationId: string;
}

interface CacheToken { token: string; expiraEm: number }

/** Troca o JWT do App por um token de instalação (~1h), com cache em processo. */
export class GithubAuth {
  private cache: CacheToken | null = null;
  constructor(private readonly cfg: ConfigGithubApp) {}

  async token(): Promise<string> {
    const agora = Date.now();
    if (this.cache && this.cache.expiraEm - 60_000 > agora) return this.cache.token;
    const jwt = gerarJwtApp(this.cfg.appId, this.cfg.chavePrivada, Math.floor(agora / 1000));
    const resposta = await fetch(`https://api.github.com/app/installations/${this.cfg.installationId}/access_tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!resposta.ok) throw new Error(`Falha ao obter token de instalação do GitHub: ${resposta.status} ${await resposta.text()}`);
    const dados = (await resposta.json()) as { token: string; expires_at: string };
    this.cache = { token: dados.token, expiraEm: new Date(dados.expires_at).getTime() };
    return this.cache.token;
  }
}

export class GithubClienteHttp {
  constructor(private readonly auth: GithubAuth) {}

  async rest<T>(caminho: string, init?: RequestInit): Promise<T> {
    const token = await this.auth.token();
    const resposta = await fetch(`https://api.github.com${caminho}`, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!resposta.ok) throw new Error(`GitHub REST ${caminho}: ${resposta.status} ${await resposta.text()}`);
    return (await resposta.json()) as T;
  }

  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const token = await this.auth.token();
    const resposta = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!resposta.ok) throw new Error(`GitHub GraphQL: ${resposta.status} ${await resposta.text()}`);
    const corpo = (await resposta.json()) as { data?: T; errors?: { message: string }[] };
    if (corpo.errors?.length) throw new Error(`GitHub GraphQL: ${corpo.errors.map((e) => e.message).join('; ')}`);
    return corpo.data as T;
  }
}
