import { describe, expect, it } from 'vitest';
import { Noticia, slugificar } from '../src/modules/blog/domain/noticia.js';
import { criarCasosDeUsoBlog } from '../src/modules/blog/application/use-cases.js';
import { memoria } from './memoria.js';

describe('Notícia (domínio e casos de uso)', () => {
  it('gera slug sem acento', () => {
    expect(slugificar('Thumdra, o CRM da SPL')).toBe('thumdra-o-crm-da-spl');
    const noticia = Noticia.criar({ id: '1', slug: 'rascunho', titulo: 'Rascunho interno', resumo: 'Ainda não', corpo: 'Texto', autorNome: 'SPL', agora: new Date() });
    expect(noticia.publicada).toBe(false);
  });

  it('publica e esconde rascunho da leitura pública', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const slugs: string[] = [];
    const casos = criarCasosDeUsoBlog({
      repo: deps.noticias, relogio: deps.relogio, ids: deps.ids,
      aviso: { async conteudoPublicoMudou(slug) { slugs.push(slug); } },
    });
    const criada = await casos.criar(admin, { titulo: 'Hub hexagonal', resumo: 'Notícia de exemplo', corpo: 'Corpo da notícia de exemplo' });
    expect((await casos.listarPublicas({})).itens).toHaveLength(0);
    await casos.publicar(admin, criada.id);
    const publicas = await casos.listarPublicas({});
    expect(publicas.itens.map((item) => item.slug)).toContain('hub-hexagonal');
    expect(slugs).toEqual(['hub-hexagonal']);
    expect((await casos.obterPublica('hub-hexagonal')).titulo).toBe('Hub hexagonal');
  });
});
