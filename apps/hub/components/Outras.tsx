'use client';

import { FormEvent, useState } from 'react';
import type { NoticiaDTO } from '@spl/contracts';
import { useSessao } from '@/lib/auth';
import { dados } from '@/lib/dados';
import { pode } from '@/lib/pode';
import { useAcao } from '@/lib/useAcao';
import { useCarregamento } from '@/lib/useCarregamento';

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
  const sala = useCarregamento(async () => {
    const [decisoes, objetivos] = await Promise.all([dados.decisoes.listar(), dados.objetivos.listar()]);
    return { decisoes, objetivos };
  }, []);
  const acao = useAcao();
  const [titulo, setTitulo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [progresso, setProgresso] = useState('0');
  const [periodo, setPeriodo] = useState('Q4 2026');
  const edita = pode(usuario, 'socios', 'editar');
  const { decisoes = [], objetivos = [] } = sala.dados ?? {};
  const erro = sala.erro || acao.erro;

  async function mudar(operacao: () => Promise<unknown>, padrao: string): Promise<boolean> {
    const feito = await acao.executar(operacao, padrao);
    if (feito) await sala.recarregar();
    return feito;
  }

  async function excluir(operacao: () => Promise<void>) {
    if (!window.confirm('Excluir este item?')) return;
    await mudar(operacao, 'Não foi possível excluir');
  }

  async function criarDecisao() {
    if (await mudar(() => dados.decisoes.criar({ titulo }), 'Não foi possível registrar a decisão')) setTitulo('');
  }

  async function criarObjetivo() {
    if (await mudar(() => dados.objetivos.criar({ titulo: objetivo, progresso: Number(progresso), periodo }), 'Não foi possível criar o objetivo')) setObjetivo('');
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
              {edita && <button className="btn perigo" type="button" onClick={() => void excluir(() => dados.decisoes.remover(item.id))}>Excluir</button>}
            </div>
          ))}
          {edita && (
            <form className="nova" onSubmit={(e) => { e.preventDefault(); void criarDecisao(); }}>
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
                  <input className="campo" type="number" min={0} max={100} defaultValue={item.progresso} onBlur={(e) => { const valor = Number(e.target.value); void mudar(() => dados.objetivos.atualizar(item.id, { progresso: valor }), 'Não foi possível atualizar o progresso'); }} />
                  <button className="btn perigo" type="button" onClick={() => void excluir(() => dados.objetivos.remover(item.id))}>Excluir</button>
                </div>
              )}
            </div>
          ))}
          {edita && (
            <form className="nova" onSubmit={(e) => { e.preventDefault(); void criarObjetivo(); }}>
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
  const blog = useCarregamento(() => dados.blog.todas(), []);
  const acao = useAcao();
  const [titulo, setTitulo] = useState('');
  const [resumo, setResumo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [editando, setEditando] = useState<NoticiaDTO | null>(null);
  const [excluindo, setExcluindo] = useState<NoticiaDTO | null>(null);
  const noticias = blog.dados ?? [];
  const erro = blog.erro || acao.erro;

  async function mudar(operacao: () => Promise<unknown>, padrao: string): Promise<boolean> {
    const feito = await acao.executar(operacao, padrao);
    if (feito) await blog.recarregar();
    return feito;
  }

  async function publicar(evento: FormEvent) {
    evento.preventDefault();
    if (!await mudar(() => dados.blog.criar({ titulo, resumo, corpo, publicar: true }), 'Não foi possível publicar')) return;
    setTitulo(''); setResumo(''); setCorpo('');
  }

  async function salvarEdicao(noticia: NoticiaDTO) {
    if (await mudar(() => dados.blog.atualizar(noticia.id, { titulo: noticia.titulo, resumo: noticia.resumo, corpo: noticia.corpo }), 'Não foi possível salvar')) setEditando(null);
  }

  async function excluir(noticia: NoticiaDTO) {
    if (await mudar(() => dados.blog.remover(noticia.id), 'Não foi possível excluir')) setExcluindo(null);
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
                {!noticia.publicada && <button className="btn" type="button" onClick={() => void mudar(() => dados.blog.publicar(noticia.id), 'Não foi possível publicar')}>Publicar</button>}
                {noticia.publicada && <button className="btn fantasma" type="button" onClick={() => void mudar(() => dados.blog.despublicar(noticia.id), 'Não foi possível despublicar')}>Despublicar</button>}
                <button className="btn fantasma" type="button" onClick={() => setEditando(noticia)}>Editar</button>
                <button className="btn perigo" type="button" onClick={() => setExcluindo(noticia)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {editando && (
        <form className="modal-fundo" onSubmit={(e) => { e.preventDefault(); void salvarEdicao(editando); }}>
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
              <button className="btn perigo" type="button" onClick={() => void excluir(excluindo)}>Excluir</button>
              <button className="btn fantasma" type="button" onClick={() => setExcluindo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
