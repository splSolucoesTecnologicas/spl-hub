'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import type { CidadeGeo, ClienteDTO } from '@spl/contracts';
import { useSessao } from '@/lib/auth';
import { dados, nomeDaPessoa } from '@/lib/dados';
import { pode } from '@/lib/pode';
import { useAcao } from '@/lib/useAcao';
import { useCarregamento } from '@/lib/useCarregamento';
import { SeletorCidade } from './SeletorCidade';

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
  const pagina = useCarregamento(async () => {
    const [clientes, pessoas] = await Promise.all([dados.clientes.listar(), dados.pessoas.listar()]);
    return { clientes, pessoas };
  }, []);
  const acao = useAcao();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [confirmar, setConfirmar] = useState<ClienteDTO | null>(null);
  const [aviso, setAviso] = useState('');
  const edita = pode(usuario, 'clientes', 'editar');
  const { clientes = [], pessoas = [] } = pagina.dados ?? {};
  const erro = aviso || acao.erro || (rascunho ? '' : pagina.erro);

  function abrir(novo: Rascunho | null) {
    acao.limparErro();
    setAviso('');
    setRascunho(novo);
  }

  function escolherCidade(cidade: CidadeGeo) {
    if (!rascunho) return;
    setAviso('');
    setRascunho({ ...rascunho, cidade: cidade.nome, uf: cidade.uf, latitude: String(cidade.lat), longitude: String(cidade.lon) });
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!rascunho) return;
    if (!rascunho.cidade || !rascunho.uf) { setAviso('Escolha uma cidade no mapa.'); return; }
    const corpo = {
      nome: rascunho.nome, cidade: rascunho.cidade, uf: rascunho.uf, status: rascunho.status,
      latitude: rascunho.latitude ? Number(rascunho.latitude) : undefined,
      longitude: rascunho.longitude ? Number(rascunho.longitude) : undefined,
      responsavelId: rascunho.responsavelId || null,
      ultimoContato: rascunho.ultimoContato ? new Date(rascunho.ultimoContato).toISOString() : null,
      observacoes: rascunho.observacoes,
    };
    const id = rascunho.id;
    if (!await acao.executar(() => (id ? dados.clientes.atualizar(id, corpo) : dados.clientes.criar(corpo)), 'Não foi possível salvar o cliente')) return;
    setRascunho(null);
    await pagina.recarregar();
  }

  async function excluir() {
    if (!confirmar) return;
    if (!await acao.executar(() => dados.clientes.remover(confirmar.id), 'Não foi possível excluir o cliente')) return;
    setConfirmar(null);
    await pagina.recarregar();
  }

  const nomeDe = (id: string | null) => nomeDaPessoa(pessoas, id);

  return (
    <section className="pagina">
      <div className="quadro-topo">
        <div>
          <p className="kicker">{clientes.length} clientes · {new Set(clientes.map((c) => c.uf)).size} estados</p>
          <h1>Clientes</h1>
        </div>
        {edita && <button className="btn" type="button" onClick={() => abrir(vazio)}>Adicionar cliente</button>}
      </div>
      {erro && !rascunho && <p className="erro">{erro}</p>}
      {clientes.length === 0 ? (
        <div className="vazio">
          <h2>Nenhum cliente ainda</h2>
          <p className="aviso">Quando alguém da equipe cadastrar um cliente, ele aparece aqui e no mapa. Nada vem de exemplo.</p>
          {edita && <button className="btn" type="button" onClick={() => abrir(vazio)}>Adicionar cliente</button>}
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
                  {edita && <button className="btn fantasma" type="button" onClick={() => abrir({
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
            <label>Cidade {rascunho.cidade ? <span className="aviso">· selecionado: {rascunho.cidade} · {rascunho.uf}</span> : <span className="aviso">· nenhuma cidade selecionada</span>}</label>
            <SeletorCidade ufInicial={rascunho.uf || null} onEscolher={escolherCidade} />
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
              <button className="btn fantasma" type="button" onClick={() => abrir(null)}>Cancelar</button>
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
              <button className="btn fantasma" type="button" onClick={() => { acao.limparErro(); setConfirmar(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
