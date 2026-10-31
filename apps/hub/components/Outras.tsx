'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { DecisaoDTO, ObjetivoDTO } from '@spl/contracts';
import { api, type NoticiaDTO, type Pagina } from '@/lib/api';
import { useSessao } from '@/lib/auth';
import { pode } from '@/lib/pode';

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

export function PaginaSocios() {
  const { usuario } = useSessao();
  const [decisoes, setDecisoes] = useState<DecisaoDTO[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoDTO[]>([]);
  const [titulo, setTitulo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [progresso, setProgresso] = useState('0');
  const [periodo, setPeriodo] = useState('Q4 2026');
  const [erro, setErro] = useState('');
  const edita = pode(usuario, 'socios', 'editar');

  async function carregar() {
    setDecisoes((await api<{ data: DecisaoDTO[] }>('/decisoes')).data);
    setObjetivos((await api<{ data: ObjetivoDTO[] }>('/objetivos')).data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, []);

  async function excluir(caminho: string) {
    if (!window.confirm('Excluir este item?')) return;
    await api(caminho, { method: 'DELETE' });
    await carregar();
  }

  return (
    <section className="pagina">
      <p className="kicker">Sala restrita · decisões e rumo da SPL</p>
      <h1>Sócios</h1>
      {erro && <p className="erro">{erro}</p>}
      <div className="grade">
        <article className="painel">
          <h2>Decisões</h2>
          {decisoes.length === 0 && <p className="aviso">Nenhuma decisão registrada.</p>}
          {decisoes.map((item) => (
            <div className="decisao" key={item.id}>
              <span>{item.titulo}</span>
              {edita && <button className="btn perigo" type="button" onClick={() => void excluir(`/decisoes/${item.id}`)}>Excluir</button>}
            </div>
          ))}
          {edita && (
            <form className="nova" onSubmit={(e) => { e.preventDefault(); void api('/decisoes', { method: 'POST', body: JSON.stringify({ titulo }) }).then(() => { setTitulo(''); return carregar(); }); }}>
              <input className="campo" placeholder="Nova decisão" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
              <button className="btn" type="submit">Adicionar</button>
            </form>
          )}
        </article>
        <article className="painel">
          <h2>Objetivos</h2>
          {objetivos.length === 0 && <p className="aviso">Nenhum objetivo. O trimestre começa vazio.</p>}
          {objetivos.map((item) => (
            <div key={item.id}>
              <div className="decisao"><span>{item.titulo}</span><small>{item.progresso}% · {item.periodo}</small></div>
              <div className="barra"><i style={{ width: `${item.progresso}%` }} /></div>
              {edita && (
                <div className="linha">
                  <input className="campo" type="number" min={0} max={100} defaultValue={item.progresso} onBlur={(e) => void api(`/objetivos/${item.id}`, { method: 'PATCH', body: JSON.stringify({ progresso: Number(e.target.value) }) }).then(carregar)} />
                  <button className="btn perigo" type="button" onClick={() => void excluir(`/objetivos/${item.id}`)}>Excluir</button>
                </div>
              )}
            </div>
          ))}
          {edita && (
            <form className="nova" onSubmit={(e) => { e.preventDefault(); void api('/objetivos', { method: 'POST', body: JSON.stringify({ titulo: objetivo, progresso: Number(progresso), periodo }) }).then(() => { setObjetivo(''); return carregar(); }); }}>
              <input className="campo" placeholder="Novo objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} required />
              <input className="campo" placeholder="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              <input className="campo" type="number" min={0} max={100} value={progresso} onChange={(e) => setProgresso(e.target.value)} />
              <button className="btn" type="submit">Adicionar</button>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}

export function PaginaBlog() {
  const [noticias, setNoticias] = useState<NoticiaDTO[]>([]);
  const [titulo, setTitulo] = useState('');
  const [resumo, setResumo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<NoticiaDTO | null>(null);
  const [excluindo, setExcluindo] = useState<NoticiaDTO | null>(null);

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
          {noticias.length === 0 && <p className="aviso">Nenhuma notícia. O blog começa vazio.</p>}
          {noticias.map((noticia) => (
            <article className="painel" key={noticia.id}>
              <strong>{noticia.titulo}</strong> {noticia.publicada ? <span className="chip green">publicada</span> : <span className="chip">rascunho</span>}
              <p className="aviso">{noticia.resumo}</p>
              <div className="linha">
                {!noticia.publicada && <button className="btn" type="button" onClick={() => void api(`/blog/admin/${noticia.id}/publicar`, { method: 'POST' }).then(carregar)}>Publicar</button>}
                {noticia.publicada && <button className="btn fantasma" type="button" onClick={() => void api(`/blog/admin/${noticia.id}/despublicar`, { method: 'POST' }).then(carregar)}>Despublicar</button>}
                <button className="btn fantasma" type="button" onClick={() => setEditando(noticia)}>Editar</button>
                <button className="btn perigo" type="button" onClick={() => setExcluindo(noticia)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {editando && (
        <form className="modal-fundo" onSubmit={(e) => { e.preventDefault(); void api(`/blog/admin/${editando.id}`, { method: 'PATCH', body: JSON.stringify({ titulo: editando.titulo, resumo: editando.resumo, corpo: editando.corpo }) }).then(() => { setEditando(null); return carregar(); }); }}>
          <div className="modal">
            <h2>Editar notícia</h2>
            <input className="campo" value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} />
            <input className="campo" value={editando.resumo} onChange={(e) => setEditando({ ...editando, resumo: e.target.value })} />
            <textarea className="campo" rows={6} value={editando.corpo} onChange={(e) => setEditando({ ...editando, corpo: e.target.value })} />
            <div className="linha"><button className="btn" type="submit">Salvar</button><button className="btn fantasma" type="button" onClick={() => setEditando(null)}>Cancelar</button></div>
          </div>
        </form>
      )}
      {excluindo && (
        <div className="modal-fundo">
          <div className="modal" role="alertdialog">
            <h2>Excluir notícia</h2>
            <p>Excluir “{excluindo.titulo}”? Se estava publicada, a landing deixa de recebê-la no próximo build.</p>
            <div className="linha">
              <button className="btn perigo" type="button" onClick={() => void api(`/blog/admin/${excluindo.id}`, { method: 'DELETE' }).then(() => { setExcluindo(null); return carregar(); })}>Excluir</button>
              <button className="btn fantasma" type="button" onClick={() => setExcluindo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
