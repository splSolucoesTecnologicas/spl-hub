'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { ClienteDTO, ProjetoDTO, UsuarioDTO } from '@spl/contracts';
import { api, type Pagina } from '@/lib/api';
import { useSessao } from '@/lib/auth';
import { pode } from '@/lib/pode';
import { Quadro } from './Quadro';

const TIPOS = [
  ['produto', 'Produto'],
  ['sob_medida', 'Sob medida'],
  ['interno', 'Interno'],
] as const;
const STATUS = [
  ['piloto', 'Piloto', 'green'],
  ['validacao', 'Validação', 'amber'],
  ['em_desenvolvimento', 'Em desenvolvimento', 'blue'],
  ['proposta', 'Proposta', 'amber'],
  ['pausado', 'Pausado', ''],
  ['concluido', 'Concluído', 'green'],
] as const;
const AREAS = [
  ['dev', 'Dev', 'dev'],
  ['marketing', 'Marketing', 'mkt'],
  ['administracao', 'Administração', 'adm'],
  ['admin_produto', 'Admin do produto', 'admin'],
] as const;
const MARCOS = [
  ['em_andamento', 'em andamento'],
  ['aguardando_resposta', 'aguardando resposta'],
  ['em_revisao', 'em revisão'],
  ['feito', 'feito'],
] as const;

type Rascunho = {
  id?: string;
  nome: string;
  tipo: ProjetoDTO['tipo'];
  status: ProjetoDTO['status'];
  descricao: string;
  cor: string;
  repositorio: string;
  quadroUrl: string;
  adminUrl: string;
  progresso: string;
  progressoRotulo: string;
  responsaveis: Record<string, string[]>;
  clienteIds: string[];
};

const base = (): Rascunho => ({
  nome: '', tipo: 'produto', status: 'piloto', descricao: '', cor: '#4c8dff', repositorio: '', quadroUrl: '', adminUrl: '',
  progresso: '0', progressoRotulo: '', responsaveis: {}, clienteIds: [],
});

function deProjeto(projeto: ProjetoDTO): Rascunho {
  const responsaveis: Record<string, string[]> = {};
  for (const item of projeto.responsaveis) {
    responsaveis[item.area] = [...(responsaveis[item.area] ?? []), item.usuarioId];
  }
  return {
    id: projeto.id, nome: projeto.nome, tipo: projeto.tipo, status: projeto.status, descricao: projeto.descricao, cor: projeto.cor,
    repositorio: projeto.repositorio ?? '', quadroUrl: projeto.quadroUrl ?? '', adminUrl: projeto.adminUrl ?? '',
    progresso: String(projeto.progresso), progressoRotulo: projeto.progressoRotulo, responsaveis, clienteIds: [...projeto.clienteIds],
  };
}

function corpoDe(rascunho: Rascunho) {
  const responsaveis = Object.entries(rascunho.responsaveis).flatMap(([area, ids]) => ids.filter(Boolean).map((usuarioId) => ({ area, usuarioId })));
  return {
    nome: rascunho.nome, tipo: rascunho.tipo, status: rascunho.status, descricao: rascunho.descricao, cor: rascunho.cor,
    repositorio: rascunho.repositorio || null, quadroUrl: rascunho.quadroUrl || null, adminUrl: rascunho.adminUrl || null,
    progresso: Number(rascunho.progresso || 0), progressoRotulo: rascunho.progressoRotulo, responsaveis, clienteIds: rascunho.clienteIds,
  };
}

export function ListaProjetos() {
  const { usuario } = useSessao();
  const [projetos, setProjetos] = useState<ProjetoDTO[]>([]);
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [filtro, setFiltro] = useState<'todos' | ProjetoDTO['tipo']>('todos');
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState('');
  const edita = pode(usuario, 'projetos', 'editar');

  async function carregar() {
    const [lista, time] = await Promise.all([
      api<Pagina<ProjetoDTO>>('/projetos?limite=100'),
      api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100'),
    ]);
    setProjetos(lista.data);
    setPessoas(time.data);
    if (pode(usuario, 'clientes', 'so_frentes')) setClientes((await api<Pagina<ClienteDTO>>('/clientes?limite=100')).data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, []);

  const visiveis = projetos.filter((item) => filtro === 'todos' || item.tipo === filtro);
  const nomeDe = (id: string) => pessoas.find((pessoa) => pessoa.id === id)?.nome.split(' ')[0] ?? '—';

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!rascunho) return;
    setErro('');
    try {
      if (rascunho.id) await api(`/projetos/${rascunho.id}`, { method: 'PATCH', body: JSON.stringify(corpoDe(rascunho)) });
      else await api('/projetos', { method: 'POST', body: JSON.stringify(corpoDe(rascunho)) });
      setRascunho(null);
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar');
    }
  }

  return (
    <section className="pagina">
      <div className="quadro-topo">
        <div>
          <p className="kicker">Produtos e projetos sob medida</p>
          <h1>Projetos</h1>
        </div>
        {edita && <button className="btn" type="button" onClick={() => { setErro(''); setRascunho(base()); }}>+ Novo projeto</button>}
      </div>
      <div className="abas" style={{ marginBottom: 16 }}>
        {([['todos', 'Todos'], ...TIPOS] as const).map(([id, nome]) => (
          <button key={id} type="button" className={filtro === id ? 'ativo' : undefined} onClick={() => setFiltro(id)}>{nome}</button>
        ))}
      </div>
      {erro && !rascunho && <p className="erro">{erro}</p>}
      {visiveis.length === 0 ? (
        <div className="vazio">
          <h2>Nenhum projeto ainda</h2>
          <p className="aviso">Thumdra, Corujuris e os trabalhos sob medida entram por aqui. Em produção a lista começa vazia.</p>
          {edita && <button className="btn" type="button" onClick={() => setRascunho(base())}>Novo projeto</button>}
        </div>
      ) : (
        <div className="cards-projetos">
          {visiveis.map((projeto) => {
            const status = STATUS.find((item) => item[0] === projeto.status);
            const tipo = TIPOS.find((item) => item[0] === projeto.tipo)?.[1];
            const clientesLigados = clientes.filter((item) => projeto.clienteIds.includes(item.id));
            const responsaveis = projeto.responsaveis.map((item) => `${nomeDe(item.usuarioId)} (${AREAS.find((area) => area[0] === item.area)?.[2] ?? item.area})`).join(' · ');
            return (
              <Link key={projeto.id} href={`/projetos/${projeto.id}`} className="card-projeto">
                <div className="linha" style={{ justifyContent: 'space-between' }}>
                  <h2>{projeto.nome}</h2>
                  <span className={`pill ${status?.[2] ?? ''}`}>{status?.[1] ?? projeto.status}</span>
                </div>
                <p className="tipo">{tipo}{projeto.descricao ? ` · ${projeto.descricao}` : ''}</p>
                <div className="meta"><span>Cliente(s)</span><b>{clientesLigados.length ? (clientesLigados.length === 1 ? clientesLigados[0]!.nome : `${clientesLigados.length} clientes`) : 'nenhum'}</b></div>
                <div className="meta"><span>Responsáveis</span><b>{responsaveis || '—'}</b></div>
                <p className="repo">{projeto.repositorio ? `⌂ ${projeto.repositorio}` : 'sem repositório'}</p>
                <div className="barra"><i style={{ width: `${projeto.progresso}%`, background: projeto.cor }} /></div>
                <strong style={{ marginLeft: 'auto' }}>{projeto.progresso}%</strong>
              </Link>
            );
          })}
        </div>
      )}
      {rascunho && (
        <FormularioProjeto rascunho={rascunho} setRascunho={setRascunho} pessoas={pessoas} clientes={clientes} erro={erro} onSalvar={salvar} onFechar={() => setRascunho(null)} />
      )}
    </section>
  );
}

function FormularioProjeto({ rascunho, setRascunho, pessoas, clientes, erro, onSalvar, onFechar }: {
  rascunho: Rascunho;
  setRascunho: (valor: Rascunho) => void;
  pessoas: UsuarioDTO[];
  clientes: ClienteDTO[];
  erro: string;
  onSalvar: (evento: FormEvent) => void;
  onFechar: () => void;
}) {
  return (
    <div className="modal-fundo">
      <form className="modal" onSubmit={onSalvar}>
        <h2>{rascunho.id ? 'Editar projeto' : 'Novo projeto'}</h2>
        {erro && <p className="erro">{erro}</p>}
        <label>Nome<input className="campo" value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} required /></label>
        <div className="linha">
          <label>Tipo
            <select className="campo" value={rascunho.tipo} onChange={(e) => setRascunho({ ...rascunho, tipo: e.target.value as ProjetoDTO['tipo'] })}>
              {TIPOS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </label>
          <label>Status
            <select className="campo" value={rascunho.status} onChange={(e) => setRascunho({ ...rascunho, status: e.target.value as ProjetoDTO['status'] })}>
              {STATUS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </label>
        </div>
        <label>Descrição<input className="campo" value={rascunho.descricao} onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })} placeholder="Uma linha sobre o projeto" /></label>
        <label>Cor no mapa<input className="campo" type="color" value={rascunho.cor} onChange={(e) => setRascunho({ ...rascunho, cor: e.target.value })} /></label>
        <label>Repositório GitHub<input className="campo" value={rascunho.repositorio} onChange={(e) => setRascunho({ ...rascunho, repositorio: e.target.value })} placeholder="dono/repositorio" /></label>
        <label>Link do GitHub Project / quadro<input className="campo" value={rascunho.quadroUrl} onChange={(e) => setRascunho({ ...rascunho, quadroUrl: e.target.value })} placeholder="https://" /></label>
        <label>URL do admin<input className="campo" value={rascunho.adminUrl} onChange={(e) => setRascunho({ ...rascunho, adminUrl: e.target.value })} placeholder="https://" /></label>
        <div className="linha">
          <label>Progresso %<input className="campo" type="number" min={0} max={100} value={rascunho.progresso} onChange={(e) => setRascunho({ ...rascunho, progresso: e.target.value })} /></label>
          <label>Rótulo do progresso<input className="campo" value={rascunho.progressoRotulo} onChange={(e) => setRascunho({ ...rascunho, progressoRotulo: e.target.value })} placeholder="Rótulo curto" /></label>
        </div>
        {AREAS.map(([area, nome]) => (
          <label key={area}>{nome}
            <select className="campo" multiple value={rascunho.responsaveis[area] ?? []} onChange={(e) => {
              const ids = [...e.target.selectedOptions].map((opcao) => opcao.value);
              setRascunho({ ...rascunho, responsaveis: { ...rascunho.responsaveis, [area]: ids } });
            }}>
              {pessoas.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}</option>)}
            </select>
          </label>
        ))}
        <label>Clientes vinculados
          <select className="campo" multiple value={rascunho.clienteIds} onChange={(e) => setRascunho({ ...rascunho, clienteIds: [...e.target.selectedOptions].map((opcao) => opcao.value) })}>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </select>
        </label>
        {clientes.length === 0 && <p className="aviso">Nenhum cliente cadastrado ainda. Dá para vincular depois.</p>}
        <div className="linha">
          <button className="btn" type="submit">Salvar</button>
          <button className="btn fantasma" type="button" onClick={onFechar}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

export function DetalheProjeto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario } = useSessao();
  const [projeto, setProjeto] = useState<ProjetoDTO | null>(null);
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [tarefasAbertas, setTarefasAbertas] = useState(0);
  const [emRevisao, setEmRevisao] = useState(0);
  const [aba, setAba] = useState<'geral' | 'quadro' | 'admin' | 'clientes' | 'repo'>('geral');
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [marco, setMarco] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');
  const edita = pode(usuario, 'projetos', 'editar');

  async function carregar() {
    const atual = await api<ProjetoDTO>(`/projetos/${id}`);
    setProjeto(atual);
    setPessoas((await api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100')).data);
    if (pode(usuario, 'clientes', 'so_frentes')) setClientes((await api<Pagina<ClienteDTO>>('/clientes?limite=100')).data);
    if (pode(usuario, 'tarefas', 'ler')) {
      const quadro = await api<Pagina<{ coluna: string }>>(`/tarefas?projetoId=${id}&limite=100`);
      setTarefasAbertas(quadro.data.filter((item) => item.coluna !== 'feito').length);
      setEmRevisao(quadro.data.filter((item) => item.coluna === 'revisao').length);
    }
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, [id]);

  const ligados = useMemo(() => clientes.filter((item) => projeto?.clienteIds.includes(item.id)), [clientes, projeto]);
  const nomeDe = (usuarioId: string) => pessoas.find((pessoa) => pessoa.id === usuarioId)?.nome.split(' ')[0] ?? 'pessoa removida';

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!rascunho) return;
    await api(`/projetos/${id}`, { method: 'PATCH', body: JSON.stringify({ ...corpoDe(rascunho), marcos: projeto?.marcos }) });
    setRascunho(null);
    await carregar();
  }

  async function excluir() {
    await api(`/projetos/${id}`, { method: 'DELETE' });
    router.push('/projetos');
  }

  async function adicionarMarco(evento: FormEvent) {
    evento.preventDefault();
    if (!projeto || marco.trim().length < 2) return;
    await api(`/projetos/${id}`, { method: 'PATCH', body: JSON.stringify({ marcos: [...projeto.marcos, { titulo: marco, status: 'em_andamento', detalhe: '' }] }) });
    setMarco('');
    await carregar();
  }

  async function removerMarco(marcoId: string) {
    if (!projeto || !window.confirm('Excluir este marco?')) return;
    await api(`/projetos/${id}`, { method: 'PATCH', body: JSON.stringify({ marcos: projeto.marcos.filter((item) => item.id !== marcoId) }) });
    await carregar();
  }

  if (!projeto) return <section className="pagina"><p>{erro || 'Carregando projeto…'}</p></section>;
  const tipo = TIPOS.find((item) => item[0] === projeto.tipo)?.[1];
  const status = STATUS.find((item) => item[0] === projeto.status);

  return (
    <section className="pagina">
      <p className="kicker">Projeto · {tipo} · {status?.[1]}</p>
      <div className="quadro-topo">
        <h1>{projeto.nome}</h1>
        <div className="linha">
          {edita && <button className="btn fantasma" type="button" onClick={() => setRascunho(deProjeto(projeto))}>Editar</button>}
          {edita && <button className="btn perigo" type="button" onClick={() => setConfirmar(true)}>Excluir</button>}
        </div>
      </div>
      <p><Link href="/projetos">← Projetos</Link></p>
      <div className="abas" style={{ margin: '12px 0' }}>
        {([['geral', 'Visão geral'], ['quadro', 'Quadro'], ['admin', 'Admin'], ['clientes', 'Clientes'], ['repo', 'Repo']] as const).map(([chave, nome]) => (
          <button key={chave} type="button" className={aba === chave ? 'ativo' : undefined} onClick={() => setAba(chave)}>{nome}</button>
        ))}
      </div>
      {aba === 'geral' && (
        <>
          <div className="stats-projeto">
            <article><small>PROGRESSO</small><b>{projeto.progresso}%</b><span className="aviso">{projeto.progressoRotulo || 'sem rótulo'}</span></article>
            <article><small>CLIENTES</small><b>{ligados.length}</b><span className="aviso">{new Set(ligados.map((item) => item.uf)).size} estados</span></article>
            <article><small>TAREFAS ABERTAS</small><b>{tarefasAbertas}</b><span className="aviso">{emRevisao} em revisão</span></article>
            <article><small>REPOSITÓRIO</small><b>{projeto.repositorio ? 'ligado' : '—'}</b><span className="aviso">{projeto.repositorio ?? 'sem repo'}</span></article>
          </div>
          <div className="detalhe-grade">
            <article className="painel">
              <h2>Responsáveis por área</h2>
              {AREAS.map(([area, nome]) => {
                const nomes = projeto.responsaveis.filter((item) => item.area === area).map((item) => nomeDe(item.usuarioId));
                return <div className="meta" key={area}><span>{nome}</span><b>{nomes.join(' · ') || '—'}</b></div>;
              })}
            </article>
            <article className="painel">
              <h2>Repositório</h2>
              <p>{projeto.repositorio ?? 'Nenhum repositório configurado.'}</p>
              {projeto.quadroUrl && <p><a href={projeto.quadroUrl}>Abrir quadro</a></p>}
            </article>
            <article className="painel">
              <h2>Admin do produto</h2>
              <p className="aviso">As telas de admin ficam no endereço configurado no projeto.</p>
              {projeto.adminUrl ? <a className="btn" href={projeto.adminUrl}>Abrir Admin →</a> : <p>Sem URL de admin.</p>}
            </article>
          </div>
          <article className="painel" style={{ marginTop: 12 }}>
            <h2>Marcos</h2>
            {projeto.marcos.length === 0 && <p className="aviso">Nenhum marco. O projeto começa sem marcos prontos.</p>}
            {projeto.marcos.map((item) => (
              <div className="decisao" key={item.id}>
                <span>● {item.titulo}</span>
                <small>{MARCOS.find((statusItem) => statusItem[0] === item.status)?.[1]} {edita && <button className="btn fantasma" type="button" onClick={() => void removerMarco(item.id)}>excluir</button>}</small>
              </div>
            ))}
            {edita && (
              <form className="nova" onSubmit={(e) => void adicionarMarco(e)}>
                <input className="campo" placeholder="Novo marco" value={marco} onChange={(e) => setMarco(e.target.value)} />
              </form>
            )}
          </article>
        </>
      )}
      {aba === 'quadro' && <Quadro projetoId={id} embutido />}
      {aba === 'admin' && (
        <article className="painel">
          <h2>Admin</h2>
          <p>{projeto.descricao || 'Sem descrição.'}</p>
          {projeto.adminUrl ? <a className="btn" href={projeto.adminUrl}>Abrir Admin →</a> : <p className="aviso">Cadastre a URL do admin ao editar o projeto.</p>}
        </article>
      )}
      {aba === 'clientes' && (
        <article className="painel">
          <h2>Clientes vinculados</h2>
          {ligados.length === 0 && <p className="aviso">Nenhum cliente neste projeto. <Link href="/clientes">Cadastrar cliente</Link></p>}
          {ligados.map((cliente) => <div className="cliente" key={cliente.id}><span>{cliente.nome}</span><small>{cliente.cidade} · {cliente.uf}</small></div>)}
        </article>
      )}
      {aba === 'repo' && (
        <article className="painel">
          <h2>Repositório</h2>
          {projeto.repositorio ? <p><a href={`https://github.com/${projeto.repositorio}`}>{projeto.repositorio}</a></p> : <p className="aviso">Sem repositório. Commits e pull requests não são inventados.</p>}
          {projeto.quadroUrl && <p><a href={projeto.quadroUrl}>GitHub Project</a></p>}
        </article>
      )}
      {rascunho && <FormularioProjeto rascunho={rascunho} setRascunho={setRascunho} pessoas={pessoas} clientes={clientes} erro={erro} onSalvar={(e) => void salvar(e)} onFechar={() => setRascunho(null)} />}
      {confirmar && (
        <div className="modal-fundo">
          <div className="modal" role="alertdialog">
            <h2>Excluir projeto</h2>
            <p>Excluir {projeto.nome}? As tarefas deixam de aparecer nesta ficha. Esta ação não desfaz.</p>
            <div className="linha">
              <button className="btn perigo" type="button" onClick={() => void excluir()}>Excluir</button>
              <button className="btn fantasma" type="button" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
