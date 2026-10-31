import type { AvisoPaginas } from '../../application/use-cases.js';

/** Dispara `repository_dispatch` (evento `blog-publicado`) para o workflow das Pages rebuildar a landing. */
export class AvisoPaginasGithub implements AvisoPaginas {
  constructor(private readonly cfg: { token?: string; repositorio?: string }) {}

  async conteudoPublicoMudou(slug: string): Promise<void> {
    if (!this.cfg.token || !this.cfg.repositorio) return;
    const resposta = await fetch(`https://api.github.com/repos/${this.cfg.repositorio}/dispatches`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.cfg.token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'spl-hub',
      },
      body: JSON.stringify({ event_type: 'blog-publicado', client_payload: { slug } }),
    });
    if (!resposta.ok) console.error(`Dispatch das Pages falhou (${resposta.status}). A notícia foi salva; o rebuild estático não foi pedido.`);
  }
}
