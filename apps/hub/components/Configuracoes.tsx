'use client';

import { useState } from 'react';
import type { CidadeGeo } from '@spl/contracts';
import { useSessao } from '@/lib/auth';
import { dados } from '@/lib/dados';
import { useAcao } from '@/lib/useAcao';
import { useCarregamento } from '@/lib/useCarregamento';
import { SeletorCidade } from './SeletorCidade';

export function PaginaConfiguracoes() {
  const { usuario, recarregar } = useSessao();
  const [nome, setNome] = useState(usuario.nome);
  const [editandoCidade, setEditandoCidade] = useState(false);
  const [aviso, setAviso] = useState('');
  const acao = useAcao();
  const erro = acao.erro;
  const github = useCarregamento(() => dados.github.status(), []).dados ?? null;

  async function salvarNome() {
    setAviso('');
    if (await acao.executar(async () => { await dados.pessoas.atualizar(usuario.id, { nome }); await recarregar(); }, 'Não foi possível salvar')) {
      setAviso('Nome atualizado');
    }
  }

  async function escolherCidade(cidade: CidadeGeo) {
    setAviso('');
    const salvo = await acao.executar(async () => {
      await dados.pessoas.atualizar(usuario.id, { cidade: cidade.nome, uf: cidade.uf, latitude: cidade.lat, longitude: cidade.lon });
      await recarregar();
    }, 'Não foi possível salvar');
    if (!salvo) return;
    setEditandoCidade(false);
    setAviso('Cidade atualizada');
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
        <h2>Integração GitHub</h2>
        {github == null && <p className="aviso">Verificando…</p>}
        {github && (
          <p>
            <span className={`chip ${github.conectado ? 'green' : ''}`}>{github.conectado ? 'Conectada' : 'Não conectada'}</span>
            {github.conectado && github.organizacao && <span className="aviso"> · organização {github.organizacao}</span>}
          </p>
        )}
      </article>
      <article className="painel">
        <span className="chip amber">esboço nesta entrega</span>
        <p>Domínio, integrações e segredos continuam no ambiente (Dokploy). Esta tela não altera produção.</p>
      </article>
    </section>
  );
}
