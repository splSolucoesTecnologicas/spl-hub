'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { geocodificar, listarCidades, type ClienteDTO, type UsuarioDTO } from '@spl/contracts';
import { ESTADOS } from '@/lib/brasil';
import { desprojetar } from '@/lib/geo';
import { api, type Pagina } from '@/lib/api';
import { useSessao } from '@/lib/auth';
import { pode } from '@/lib/pode';

type Rascunho = {
  id?: string;
  nome: string;
  cidade: string;
  uf: string;
  latitude: string;
  longitude: string;
  status: string;
  responsavelId: string;
  ultimoContato: string;
  observacoes: string;
};

const vazio: Rascunho = { nome: '', cidade: '', uf: '', latitude: '', longitude: '', status: 'Ativo', responsavelId: '', ultimoContato: '', observacoes: '' };

export function PaginaClientes() {
  const { usuario } = useSessao();
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [pessoas, setPessoas] = useState<UsuarioDTO[]>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [confirmar, setConfirmar] = useState<ClienteDTO | null>(null);
  const [erro, setErro] = useState('');
  const edita = pode(usuario, 'clientes', 'editar');

  async function carregar() {
    setClientes((await api<Pagina<ClienteDTO>>('/clientes?limite=100')).data);
    setPessoas((await api<Pagina<UsuarioDTO>>('/acesso/usuarios?limite=100')).data);
  }
  useEffect(() => { void carregar().catch((falha: Error) => setErro(falha.message)); }, []);

  function localizar() {
    if (!rascunho) return;
    const geo = geocodificar(rascunho.cidade, rascunho.uf);
    if (!geo) { setErro('Cidade não encontrada. Clique no mapa para marcar o ponto.'); return; }
    setErro('');
    setRascunho({ ...rascunho, latitude: String(geo.lat), longitude: String(geo.lon), uf: geo.uf });
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!rascunho) return;
    const corpo = {
      nome: rascunho.nome, cidade: rascunho.cidade, uf: rascunho.uf, status: rascunho.status,
      latitude: rascunho.latitude ? Number(rascunho.latitude) : undefined,
      longitude: rascunho.longitude ? Number(rascunho.longitude) : undefined,
      responsavelId: rascunho.responsavelId || null,
      ultimoContato: rascunho.ultimoContato ? new Date(rascunho.ultimoContato).toISOString() : null,
      observacoes: rascunho.observacoes,
    };
    if (rascunho.id) await api(`/clientes/${rascunho.id}`, { method: 'PATCH', body: JSON.stringify(corpo) });
    else await api('/clientes', { method: 'POST', body: JSON.stringify(corpo) });
    setRascunho(null);
    await carregar();
  }

  async function excluir() {
    if (!confirmar) return;
    await api(`/clientes/${confirmar.id}`, { method: 'DELETE' });
    setConfirmar(null);
    await carregar();
  }

  const nomeDe = (id: string | null) => pessoas.find((pessoa) => pessoa.id === id)?.nome ?? '—';

  return (
    <section className="pagina">
      <div className="quadro-topo">
        <div>
          <p className="kicker">{clientes.length} clientes · {new Set(clientes.map((c) => c.uf)).size} estados</p>
          <h1>Clientes</h1>
        </div>
        {edita && <button className="btn" type="button" onClick={() => { setErro(''); setRascunho(vazio); }}>Adicionar cliente</button>}
      </div>
      {erro && !rascunho && <p className="erro">{erro}</p>}
      {clientes.length === 0 ? (
        <div className="vazio">
          <h2>Nenhum cliente ainda</h2>
          <p className="aviso">Quando alguém da equipe cadastrar um cliente, ele aparece aqui e no mapa. Nada vem de exemplo.</p>
          {edita && <button className="btn" type="button" onClick={() => setRascunho(vazio)}>Adicionar cliente</button>}
        </div>
      ) : (
        <table className="tabela">
          <thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Status</th><th>Responsável</th><th>Último contato</th><th></th></tr></thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nome}</td>
                <td>{cliente.cidade} · {cliente.uf}</td>
                <td>{cliente.status}</td>
                <td>{nomeDe(cliente.responsavelId)}</td>
                <td>{cliente.ultimoContato ? new Date(cliente.ultimoContato).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="linha">
                  <Link href={`/?cliente=${cliente.id}`}>mapa</Link>
                  {edita && <button className="btn fantasma" type="button" onClick={() => setRascunho({
                    id: cliente.id, nome: cliente.nome, cidade: cliente.cidade, uf: cliente.uf,
                    latitude: String(cliente.latitude), longitude: String(cliente.longitude), status: cliente.status,
                    responsavelId: cliente.responsavelId ?? '', ultimoContato: cliente.ultimoContato ? cliente.ultimoContato.slice(0, 10) : '', observacoes: cliente.observacoes,
                  })}>Editar</button>}
                  {edita && <button className="btn perigo" type="button" onClick={() => setConfirmar(cliente)}>Excluir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rascunho && (
        <div className="modal-fundo">
          <form className="modal" onSubmit={(e) => void salvar(e)}>
            <h2>{rascunho.id ? 'Editar cliente' : 'Novo cliente'}</h2>
            {erro && <p className="erro">{erro}</p>}
            <label>Nome<input className="campo" value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} required /></label>
            <div className="linha">
              <label>Cidade
                <input className="campo" list="cidades" value={rascunho.cidade} onChange={(e) => setRascunho({ ...rascunho, cidade: e.target.value })} required />
                <datalist id="cidades">{listarCidades().map((cidade) => <option key={`${cidade.uf}-${cidade.nome}`} value={cidade.nome}>{cidade.uf}</option>)}</datalist>
              </label>
              <label>UF<input className="campo" maxLength={2} value={rascunho.uf} onChange={(e) => setRascunho({ ...rascunho, uf: e.target.value.toUpperCase() })} required /></label>
            </div>
            <button className="btn fantasma" type="button" onClick={localizar}>Geocodificar pela cidade</button>
            <div className="mini-mapa">
              <svg viewBox="0 0 640 640" aria-label="Escolher ponto no mapa" onClick={(evento) => {
                const svg = evento.currentTarget;
                const caixa = svg.getBoundingClientRect();
                const x = ((evento.clientX - caixa.left) / caixa.width) * 640;
                const y = ((evento.clientY - caixa.top) / caixa.height) * 640;
                const ponto = desprojetar(x, y);
                setRascunho({ ...rascunho, latitude: ponto.lat.toFixed(4), longitude: ponto.lon.toFixed(4) });
              }}>
                {ESTADOS.map((estado) => <path key={estado.sigla} className="estado" d={estado.d} />)}
              </svg>
            </div>
            <div className="linha">
              <label>Latitude<input className="campo" value={rascunho.latitude} onChange={(e) => setRascunho({ ...rascunho, latitude: e.target.value })} /></label>
              <label>Longitude<input className="campo" value={rascunho.longitude} onChange={(e) => setRascunho({ ...rascunho, longitude: e.target.value })} /></label>
            </div>
            <label>Status<input className="campo" value={rascunho.status} onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })} required /></label>
            <label>Responsável
              <select className="campo" value={rascunho.responsavelId} onChange={(e) => setRascunho({ ...rascunho, responsavelId: e.target.value })}>
                <option value="">Sem responsável</option>
                {pessoas.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}</option>)}
              </select>
            </label>
            <label>Último contato<input className="campo" type="date" value={rascunho.ultimoContato} onChange={(e) => setRascunho({ ...rascunho, ultimoContato: e.target.value })} /></label>
            <label>Observações<textarea className="campo" rows={3} value={rascunho.observacoes} onChange={(e) => setRascunho({ ...rascunho, observacoes: e.target.value })} /></label>
            <div className="linha">
              <button className="btn" type="submit">Salvar</button>
              <button className="btn fantasma" type="button" onClick={() => setRascunho(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
      {confirmar && (
        <div className="modal-fundo">
          <div className="modal" role="alertdialog">
            <h2>Excluir cliente</h2>
            <p>Excluir {confirmar.nome}? O ponto sai do mapa. Esta ação não desfaz.</p>
            <div className="linha">
              <button className="btn perigo" type="button" onClick={() => void excluir()}>Excluir</button>
              <button className="btn fantasma" type="button" onClick={() => setConfirmar(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
