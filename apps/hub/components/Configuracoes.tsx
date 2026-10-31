'use client';

import { useState } from 'react';
import type { CidadeGeo } from '@spl/contracts';
import { api } from '@/lib/api';
import { useSessao } from '@/lib/auth';
import { SeletorCidade } from './SeletorCidade';

export function PaginaConfiguracoes() {
  const { usuario, recarregar } = useSessao();
  const [nome, setNome] = useState(usuario.nome);
  const [editandoCidade, setEditandoCidade] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  async function salvarNome() {
    setErro('');
    try {
      await api(`/acesso/usuarios/${usuario.id}`, { method: 'PATCH', body: JSON.stringify({ nome }) });
      await recarregar();
      setAviso('Nome atualizado');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar');
    }
  }

  async function escolherCidade(cidade: CidadeGeo) {
    setErro('');
    try {
      await api(`/acesso/usuarios/${usuario.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ cidade: cidade.nome, uf: cidade.uf, latitude: cidade.lat, longitude: cidade.lon }),
      });
      await recarregar();
      setEditandoCidade(false);
      setAviso('Cidade atualizada');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar');
    }
  }

  return (
    <section className="pagina">
      <p className="kicker">Hub</p>
      <h1>Configurações</h1>
      <article className="painel">
        <h2>Meu perfil</h2>
        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="aviso">{aviso}</p>}
        <label>Nome
          <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <div className="linha" style={{ marginTop: 8 }}>
          <button className="btn" type="button" onClick={() => void salvarNome()}>Salvar nome</button>
        </div>
        <p style={{ marginTop: 16 }}>
          Cidade: {usuario.cidade ? `${usuario.cidade} · ${usuario.uf}` : 'a definir'}
          <button className="btn fantasma" type="button" onClick={() => setEditandoCidade((v) => !v)} style={{ marginLeft: 8, padding: '2px 10px' }}>
            {editandoCidade ? 'Fechar' : 'Editar cidade'}
          </button>
        </p>
        {editandoCidade && <SeletorCidade ufInicial={usuario.uf} onEscolher={(cidade) => void escolherCidade(cidade)} />}
      </article>
      <article className="painel">
        <span className="chip amber">esboço nesta entrega</span>
        <p>Domínio, integrações e segredos continuam no ambiente (Dokploy). Esta tela não altera produção.</p>
      </article>
    </section>
  );
}
