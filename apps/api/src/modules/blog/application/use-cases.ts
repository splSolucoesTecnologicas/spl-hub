import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import type { Usuario } from '../../acesso/domain/usuario.js';
import { Noticia, slugificar } from '../domain/noticia.js';

export interface NoticiaRepository {
  salvar(noticia: Noticia): Promise<void>;
  buscarPorId(id: string): Promise<Noticia | null>;
  buscarPorSlug(slug: string): Promise<Noticia | null>;
  listar(params: { limite: number; cursor?: string; somentePublicadas: boolean }): Promise<{ itens: Noticia[]; proximoCursor: string | null }>;
}

export class NoticiaNaoEncontrada extends ErroDeDominio {
  constructor() { super('nao_encontrada', 'Notícia não encontrada'); }
}

/** Avisa o workflow das GitHub Pages para rebuild estático. Sem token, não faz nada. */
export interface AvisoPaginas { conteudoPublicoMudou(slug: string): Promise<void> }
const avisoQuieto: AvisoPaginas = { async conteudoPublicoMudou() {} };

export function criarCasosDeUsoBlog(deps: { repo: NoticiaRepository; relogio: Relogio; ids: GeradorId; aviso?: AvisoPaginas }) {
  const { repo, relogio, ids } = deps;
  const aviso = deps.aviso ?? avisoQuieto;
  const avisar = (slug: string) => aviso.conteudoPublicoMudou(slug).catch(() => undefined);
  return {
    async criar(ator: Usuario, input: { titulo: string; resumo: string; corpo: string; publicar?: boolean; exemplo?: boolean }) {
      ator.exigir('blog', 'editar');
      let slug = slugificar(input.titulo);
      let n = 2;
      while (await repo.buscarPorSlug(slug)) slug = `${slugificar(input.titulo)}-${n++}`;
      const noticia = Noticia.criar({ id: ids.novo(), slug, autorNome: ator.nome, agora: relogio.agora(), ...input });
      await repo.salvar(noticia);
      if (noticia.publicada) await avisar(noticia.slug);
      return noticia;
    },
    async publicar(ator: Usuario, id: string) {
      ator.exigir('blog', 'editar');
      const noticia = await repo.buscarPorId(id);
      if (!noticia) throw new NoticiaNaoEncontrada();
      noticia.publicar(relogio.agora());
      await repo.salvar(noticia);
      await avisar(noticia.slug);
      return noticia;
    },
    async despublicar(ator: Usuario, id: string) {
      ator.exigir('blog', 'editar');
      const noticia = await repo.buscarPorId(id);
      if (!noticia) throw new NoticiaNaoEncontrada();
      noticia.despublicar();
      await repo.salvar(noticia);
      await avisar(noticia.slug);
      return noticia;
    },
    listarAdmin(ator: Usuario, params: { limite?: number; cursor?: string }) {
      ator.exigir('blog', 'ler');
      return repo.listar({ limite: Math.min(params.limite ?? 20, 100), cursor: params.cursor, somentePublicadas: false });
    },
    listarPublicas(params: { limite?: number; cursor?: string }) {
      return repo.listar({ limite: Math.min(params.limite ?? 20, 100), cursor: params.cursor, somentePublicadas: true });
    },
    async obterPublica(slug: string) {
      const noticia = await repo.buscarPorSlug(slug);
      if (!noticia || !noticia.publicada) throw new NoticiaNaoEncontrada();
      return noticia;
    },
  };
}

export type CasosDeUsoBlog = ReturnType<typeof criarCasosDeUsoBlog>;
