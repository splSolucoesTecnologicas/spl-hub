'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { CLIENTES_EXEMPLO } from '@/lib/dados-exemplo';
import { api, type NoticiaDTO, type Pagina } from '@/lib/api';

export function Esboco({ titulo, kicker, texto }: { titulo: string; kicker: string; texto: string }) {
  return (
    <section className="pagina">
      <p className="kicker">{kicker}</p>
      <h1>{titulo}</h1>
      <article className="painel">
        <span className="chip amber">esboço nesta entrega</span>
        <p>{texto}</p>
      </article>
    </section>
  );
}

export function PaginaClientes() {
  return (
    <section className="pagina">
      <p className="kicker">{CLIENTES_EXEMPLO.length} clientes · {new Set(CLIENTES_EXEMPLO.map((c) => c.uf)).size} estados</p>
      <h1>Clientes</h1>
      <span className="chip amber">dados de exemplo · módulo ainda sem API</span>
      <table className="tabela">
        <thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Projeto</th><th>Status</th><th>Responsável</th><th>Último contato</th><th></th></tr></thead>
        <tbody>
          {CLIENTES_EXEMPLO.map((cliente) => (
            <tr key={cliente.id}>
              <td>{cliente.nome}</td><td>{cliente.cidade} · {cliente.uf}</td><td>{cliente.produto}</td><td>{cliente.status}</td><td>{cliente.responsavel}</td><td>{cliente.contato}</td>
              <td><Link href={`/?cliente=${cliente.id}`}>ver no mapa</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PaginaSocios() {
  return (
    <Esboco titulo="Sócios" kicker="Sala restrita · decisões e rumo da SPL" texto="A sala de sócios (decisões, votos, objetivos e financeiro) fica para o próximo corte. Os cartões da Início usam dados de exemplo só para leitura." />
  );
}

export function PaginaBlog() {
  const [noticias, setNoticias] = useState<NoticiaDTO[]>([]);
  const [titulo, setTitulo] = useState('');
  const [resumo, setResumo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    setNoticias((await api<Pagina<NoticiaDTO>>('/blog/admin')).data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, []);

  async function publicar(evento: FormEvent) {
    evento.preventDefault();
    await api('/blog/admin', { method: 'POST', body: JSON.stringify({ titulo, resumo, corpo, publicar: true }) });
    setTitulo(''); setResumo(''); setCorpo('');
    await carregar();
  }

  return (
    <section className="pagina">
      <p className="kicker">Blog · notícias da holding</p>
      <h1>Blog</h1>
      <p className="aviso">O que está publicado aparece em splsolucoes.com/blog. Rascunhos ficam só aqui.</p>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade">
        <form className="painel nova" onSubmit={(e) => void publicar(e)}>
          <input className="campo" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          <input className="campo" placeholder="Resumo" value={resumo} onChange={(e) => setResumo(e.target.value)} required />
          <textarea className="campo" placeholder="Corpo" rows={6} value={corpo} onChange={(e) => setCorpo(e.target.value)} required />
          <button className="btn" type="submit">Publicar</button>
        </form>
        <div>
          {noticias.map((noticia) => (
            <article className="painel" key={noticia.id}>
              <strong>{noticia.titulo}</strong> {noticia.exemplo && <span className="chip amber">exemplo</span>} {noticia.publicada ? <span className="chip green">publicada</span> : <span className="chip">rascunho</span>}
              <p className="aviso">{noticia.resumo}</p>
              {!noticia.publicada && <button className="btn" type="button" onClick={() => void api(`/blog/admin/${noticia.id}/publicar`, { method: 'POST' }).then(carregar)}>Publicar</button>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
