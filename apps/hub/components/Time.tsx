'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CidadeGeo, Nivel, Permissoes, UsuarioDTO } from '@spl/contracts';
import { api, type AuditoriaDTO, type Pagina, type SolicitacaoAcessoDTO, type TarefaDTO } from '@/lib/api';
import { useSessao } from '@/lib/auth';
import { SeletorCidade } from './SeletorCidade';

const LINHAS: { id: keyof Permissoes; nome: string }[] = [
  { id: 'inicio', nome: 'Início / Radar' }, { id: 'tarefas', nome: 'Tarefas' }, { id: 'projetos', nome: 'Projetos' }, { id: 'clientes', nome: 'Clientes' }, { id: 'frentes', nome: 'Frentes (legado)' },
  { id: 'admin_thumdra', nome: 'Admin Thumdra' }, { id: 'admin_corujuris', nome: 'Admin Corujuris' },
  { id: 'blog', nome: 'Blog' }, { id: 'drive', nome: 'Drive' }, { id: 'reunioes', nome: 'Reuniões' }, { id: 'socios', nome: 'Sócios' },
];
const NIVEIS: Nivel[] = ['off', 'so_frentes', 'ler', 'editar'];
const ROTULO: Record<Nivel, string> = { off: 'Off', so_frentes: 'Só frentes', ler: 'Ler', editar: 'Editar' };

const AREAS = ['dev', 'marketing', 'administracao', 'comercial', 'financeiro', 'juridico', 'infra'] as const;

export function ListaTime() {
  const { usuario } = useSessao();
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', vinculo: 'colaborador' as 'socio' | 'colaborador', area: 'dev' as UsuarioDTO['area'], cidade: '', uf: '', admin: false });

  async function carregar() {
    setPessoas((await api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100')).data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, []);

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    try {
      await api('/acesso/usuarios', { method: 'POST', body: JSON.stringify({ ...form, cidade: form.cidade || null, uf: form.uf || null }) });
      setAberto(false);
      setForm({ nome: '', email: '', senha: '', vinculo: 'colaborador', area: 'dev', cidade: '', uf: '', admin: false });
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível adicionar');
    }
  }

  return (
    <section className="pagina">
      <div className="quadro-topo">
        <div>
          <p className="kicker">Time · pessoas</p>
          <h1>Time</h1>
        </div>
        {usuario.admin && <button className="btn" type="button" onClick={() => setAberto(true)}>Adicionar pessoa</button>}
      </div>
      {erro && !aberto && <p className="erro">{erro}</p>}
      {pessoas.length === 0 && <div className="vazio"><h2>Ninguém no time</h2><p className="aviso">O primeiro acesso é o admin inicial. As outras pessoas entram por aqui.</p></div>}
      <div className="time-lista">
        {pessoas.map((pessoa) => (
          <Link key={pessoa.id} className="painel" href={`/time/${pessoa.id}`}>
            <strong>{pessoa.nome}</strong>
            <p className="aviso">{pessoa.email}</p>
            <div className="selos">{pessoa.papeis.map((papel) => <span key={papel} className="chip green">{papel}</span>)}{!pessoa.ativo && <span className="chip">inativo</span>}</div>
          </Link>
        ))}
      </div>
      {aberto && (
        <div className="modal-fundo">
          <form className="modal" onSubmit={(e) => void criar(e)}>
            <h2>Adicionar pessoa</h2>
            {erro && <p className="erro">{erro}</p>}
            <label>Nome<input className="campo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></label>
            <label>E-mail<input className="campo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Senha inicial<input className="campo" type="text" minLength={8} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required /></label>
            <label>Vínculo
              <select className="campo" value={form.vinculo} onChange={(e) => setForm({ ...form, vinculo: e.target.value as 'socio' | 'colaborador' })}>
                <option value="socio">Sócio</option>
                <option value="colaborador">Colaborador</option>
              </select>
            </label>
            <label>Área
              <select className="campo" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as UsuarioDTO['area'] })}>
                {AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
            </label>
            <div className="linha">
              <label>Cidade<input className="campo" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></label>
              <label>UF<input className="campo" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></label>
            </div>
            <label><span>Admin</span><input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} /></label>
            <p className="aviso">A senha inicial é o primeiro acesso. O ponto verde no mapa usa a cidade e a UF.</p>
            <div className="linha">
              <button className="btn" type="submit">Adicionar</button>
              <button className="btn fantasma" type="button" onClick={() => setAberto(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

export function PerfilTime() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { usuario: eu } = useSessao();
  const [pessoa, setPessoa] = useState<UsuarioDTO | null>(null);
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [pedidos, setPedidos] = useState<SolicitacaoAcessoDTO[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaDTO[]>([]);
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [editandoCidade, setEditandoCidade] = useState(false);

  async function carregar() {
    const pagina = await api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100');
    setPessoa(pagina.data.find((item) => item.id === id) ?? null);
    const quadro = await api<Pagina<TarefaDTO>>('/tarefas?limite=100');
    setTarefas(quadro.data.filter((tarefa) => tarefa.responsavelId === id && tarefa.coluna !== 'feito'));
    setPedidos((await api<{ data: SolicitacaoAcessoDTO[] }>('/acesso/solicitacoes')).data.filter((item) => item.usuarioId === id));
    if (eu.admin) setAuditoria((await api<{ data: AuditoriaDTO[] }>('/acesso/auditoria')).data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setAviso(falha.message)); }, [id]);

  if (!pessoa) return <section className="pagina"><p>{aviso || 'Carregando perfil…'}</p></section>;

  function patch(parcial: Partial<UsuarioDTO>) { setPessoa({ ...pessoa!, ...parcial }); }

  function escolherCidade(cidade: CidadeGeo) {
    patch({ cidade: cidade.nome, uf: cidade.uf, latitude: cidade.lat, longitude: cidade.lon });
    setEditandoCidade(false);
  }

  async function salvar() {
    const atualizado = await api<UsuarioDTO>(`/acesso/usuarios/${pessoa!.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome: pessoa!.nome, vinculo: pessoa!.vinculo, area: pessoa!.area, cidade: pessoa!.cidade, uf: pessoa!.uf, latitude: pessoa!.latitude, longitude: pessoa!.longitude, admin: pessoa!.admin, frentes: pessoa!.frentes, permissoes: pessoa!.permissoes, ativo: pessoa!.ativo }),
    });
    setPessoa(atualizado);
    setAviso('Alterações salvas');
  }

  async function decidir(pedidoId: string, acao: 'autorizar' | 'recusar') {
    await api(`/acesso/solicitacoes/${pedidoId}/${acao}`, { method: 'POST' });
    await carregar();
  }

  return (
    <section className="pagina">
      <p className="kicker">Time · perfil</p>
      <h1>{pessoa.nome}</h1>
      <p><Link href="/time">← Time</Link></p>
      <div className="grade">
        <article className="painel perfil">
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{pessoa.nome[0]}</div>
          <h2>{pessoa.nome} {!pessoa.ativo && <span className="chip">inativo</span>}</h2>
          <div className="selos">{pessoa.papeis.map((papel) => <span key={papel} className="chip green">{papel}</span>)}</div>
          <dl>
            <dt>E-mail</dt><dd>{pessoa.email}</dd>
            <dt>Cidade</dt>
            <dd>
              {pessoa.cidade ? `${pessoa.cidade} · ${pessoa.uf}` : 'a definir'}
              {eu.admin && <button className="btn fantasma" type="button" onClick={() => setEditandoCidade((v) => !v)} style={{ marginLeft: 8, padding: '2px 10px' }}>{editandoCidade ? 'Fechar' : 'Editar'}</button>}
            </dd>
            <dt>2FA</dt><dd>{pessoa.totpAtivo ? 'Ativo' : 'Desligado'}</dd>
            <dt>Último acesso</dt><dd>{pessoa.ultimoAcesso ? new Date(pessoa.ultimoAcesso).toLocaleString('pt-BR') : '—'}</dd>
          </dl>
          {editandoCidade && eu.admin && (
            <>
              <SeletorCidade ufInicial={pessoa.uf} onEscolher={escolherCidade} />
              <p className="aviso">Escolha a cidade e clique em &quot;Salvar alterações&quot; abaixo pra confirmar.</p>
            </>
          )}
          <h3>Trabalhando em</h3>
          {tarefas.map((tarefa) => <p key={tarefa.id}>{tarefa.titulo}{tarefa.referencia ? ` · ${tarefa.referencia}` : ''}</p>)}
          {tarefas.length === 0 && <p className="aviso">Nada em aberto.</p>}
        </article>
        <article className="painel">
          <h2>Permissões {eu.admin && <span className="chip green">Você é admin · pode editar</span>}</h2>
          <label>Vínculo
            <div className="segmento">
              {(['socio', 'colaborador'] as const).map((vinculo) => (
                <button key={vinculo} type="button" className={pessoa.vinculo === vinculo ? 'ativo' : undefined} disabled={!eu.admin} onClick={() => patch({ vinculo })}>{vinculo === 'socio' ? 'Sócio' : 'Colaborador'}</button>
              ))}
            </div>
          </label>
          <label>Área
            <select className="campo" disabled={!eu.admin} value={pessoa.area} onChange={(e) => patch({ area: e.target.value as UsuarioDTO['area'] })}>
              {['dev', 'marketing', 'administracao', 'comercial', 'financeiro', 'juridico', 'infra'].map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
          </label>
          <p>Frentes vinculadas: {pessoa.frentes.join(', ') || 'nenhuma'}</p>
          {LINHAS.map((linha) => (
            <div className="perm-linha" key={linha.id}>
              <span>{linha.nome}</span>
              <small>{pessoa.permissoes[linha.id]?.extraAte ? `extra · até ${pessoa.permissoes[linha.id]?.extraAte}` : 'padrão'}</small>
              <select className="campo" disabled={!eu.admin || (pessoa.vinculo === 'colaborador' && linha.id === 'socios')} value={pessoa.permissoes[linha.id]?.nivel ?? 'off'} onChange={(e) => patch({ permissoes: { ...pessoa.permissoes, [linha.id]: { ...pessoa.permissoes[linha.id], nivel: e.target.value as Nivel } } })}>
                {NIVEIS.map((nivel) => <option key={nivel} value={nivel}>{ROTULO[nivel]}</option>)}
              </select>
            </div>
          ))}
          {pedidos.filter((pedido) => pedido.status === 'pendente').map((pedido) => (
            <div className="pedido" key={pedido.id}>
              <strong>Acesso extra pendente {pedido.exemplo && <span className="chip amber">exemplo</span>}</strong>
              <p>{pedido.modulo} · {pedido.nivel} · {pedido.motivo}</p>
              {eu.admin && <div className="linha"><button className="btn" type="button" onClick={() => void decidir(pedido.id, 'autorizar')}>Autorizar</button><button className="btn fantasma" type="button" onClick={() => void decidir(pedido.id, 'recusar')}>Recusar</button></div>}
            </div>
          ))}
          <p className="aviso">Toda mudança fica no log de auditoria. {auditoria[0] ? `Último: ${auditoria[0].detalhe}` : 'Sem eventos ainda.'}</p>
          {eu.admin && (
            <label>Nome
              <input className="campo" value={pessoa.nome} onChange={(e) => patch({ nome: e.target.value })} />
            </label>
          )}
          {eu.admin && <label><span>Admin</span><input type="checkbox" checked={pessoa.admin} onChange={(e) => patch({ admin: e.target.checked })} /></label>}
          {eu.admin && <label><span>Ativo</span><input type="checkbox" checked={pessoa.ativo} onChange={(e) => patch({ ativo: e.target.checked })} /></label>}
          {eu.admin && <button className="btn" type="button" onClick={() => void salvar()}>Salvar alterações</button>}
          {eu.admin && eu.id !== pessoa.id && <button className="btn perigo" type="button" onClick={() => setConfirmar(true)}>Excluir pessoa</button>}
          {aviso && <p>{aviso}</p>}
          {confirmar && (
            <div className="modal-fundo">
              <div className="modal" role="alertdialog">
                <h2>Excluir pessoa</h2>
                <p>Excluir {pessoa.nome}? Ninguém exclui a si mesmo nem o último admin.</p>
                <div className="linha">
                  <button className="btn perigo" type="button" onClick={() => void api(`/acesso/usuarios/${pessoa.id}`, { method: 'DELETE' }).then(() => router.push('/time')).catch((falha: Error) => setAviso(falha.message))}>Excluir</button>
                  <button className="btn fantasma" type="button" onClick={() => setConfirmar(false)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
