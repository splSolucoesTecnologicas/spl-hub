'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Nivel, Permissoes, UsuarioDTO } from '@spl/contracts';
import { api, type AuditoriaDTO, type Pagina, type SolicitacaoAcessoDTO, type TarefaDTO } from '@/lib/api';
import { useSessao } from '@/lib/auth';

const LINHAS: { id: keyof Permissoes; nome: string }[] = [
  { id: 'inicio', nome: 'Início / Radar' }, { id: 'tarefas', nome: 'Tarefas' }, { id: 'frentes', nome: 'Frentes' },
  { id: 'admin_thumdra', nome: 'Admin Thumdra' }, { id: 'admin_corujuris', nome: 'Admin Corujuris' },
  { id: 'blog', nome: 'Blog' }, { id: 'drive', nome: 'Drive' }, { id: 'reunioes', nome: 'Reuniões' }, { id: 'socios', nome: 'Sócios' },
];
const NIVEIS: Nivel[] = ['off', 'so_frentes', 'ler', 'editar'];
const ROTULO: Record<Nivel, string> = { off: 'Off', so_frentes: 'Só frentes', ler: 'Ler', editar: 'Editar' };

export function ListaTime() {
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  useEffect(() => { void api<Pagina<UsuarioDTO>>('/acesso/usuarios').then((p) => setPessoas(p.data)); }, []);
  return (
    <section className="pagina">
      <p className="kicker">Time · pessoas</p>
      <h1>Time</h1>
      <div className="time-lista">
        {pessoas.map((pessoa) => (
          <Link key={pessoa.id} className="painel" href={`/time/${pessoa.id}`}>
            <strong>{pessoa.nome}</strong>
            <p className="aviso">{pessoa.email}</p>
            <div className="selos">{pessoa.papeis.map((papel) => <span key={papel} className="chip green">{papel}</span>)}{pessoa.exemplo && <span className="chip amber">exemplo</span>}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PerfilTime() {
  const { id } = useParams<{ id: string }>();
  const { usuario: eu } = useSessao();
  const [pessoa, setPessoa] = useState<UsuarioDTO | null>(null);
  const [tarefas, setTarefas] = useState<TarefaDTO[]>([]);
  const [pedidos, setPedidos] = useState<SolicitacaoAcessoDTO[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaDTO[]>([]);
  const [aviso, setAviso] = useState('');

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

  async function salvar() {
    const atualizado = await api<UsuarioDTO>(`/acesso/usuarios/${pessoa!.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ vinculo: pessoa!.vinculo, area: pessoa!.area, cidade: pessoa!.cidade, uf: pessoa!.uf, frentes: pessoa!.frentes, permissoes: pessoa!.permissoes }),
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
          <h2>{pessoa.nome} {pessoa.exemplo && <span className="chip amber">exemplo</span>}</h2>
          <div className="selos">{pessoa.papeis.map((papel) => <span key={papel} className="chip green">{papel}</span>)}</div>
          <dl>
            <dt>E-mail</dt><dd>{pessoa.email}</dd>
            <dt>Cidade</dt><dd>{pessoa.cidade ? `${pessoa.cidade} · ${pessoa.uf}` : 'a definir'}</dd>
            <dt>2FA</dt><dd>{pessoa.totpAtivo ? 'Ativo' : 'Desligado'}</dd>
            <dt>Último acesso</dt><dd>{pessoa.ultimoAcesso ? new Date(pessoa.ultimoAcesso).toLocaleString('pt-BR') : '—'}</dd>
          </dl>
          <h3>Trabalhando em · exemplo</h3>
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
          {eu.admin && <button className="btn" type="button" onClick={() => void salvar()}>Salvar alterações</button>}
          {aviso && <p>{aviso}</p>}
        </article>
      </div>
    </section>
  );
}
