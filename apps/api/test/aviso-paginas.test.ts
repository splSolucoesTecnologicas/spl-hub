import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisoPaginasGithub } from '../src/modules/blog/adapters/out/aviso-paginas.js';

afterEach(() => { vi.unstubAllGlobals(); });

describe('Aviso das GitHub Pages', () => {
  it('não chama o GitHub sem token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await new AvisoPaginasGithub({}).conteudoPublicoMudou('hub');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pede o repository_dispatch blog-publicado', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await new AvisoPaginasGithub({ token: 't', repositorio: 'splSolucoesTecnologicas/spl-hub' }).conteudoPublicoMudou('hub');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/splSolucoesTecnologicas/spl-hub/dispatches');
    expect(JSON.parse(String(init.body))).toEqual({ event_type: 'blog-publicado', client_payload: { slug: 'hub' } });
  });
});