'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type UsuarioDTO } from '@/lib/api';
import { asset } from '@/lib/base';
import { gravarSessao } from '@/lib/sessao';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [desafio, setDesafio] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    try {
      if (!desafio) {
        const resposta = await api<{ requer2fa: boolean; desafio?: string; token?: string; usuario?: UsuarioDTO }>('/acesso/login', {
          method: 'POST', body: JSON.stringify({ email, senha }),
        });
        if (resposta.requer2fa && resposta.desafio) { setDesafio(resposta.desafio); return; }
        gravarSessao(resposta.token ?? '');
      } else {
        const resposta = await api<{ token: string }>('/acesso/login/totp', { method: 'POST', body: JSON.stringify({ desafio, codigo }) });
        gravarSessao(resposta.token);
      }
      router.replace('/');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar');
    }
  }

  return (
    <main className="login">
      <form onSubmit={entrar}>
        <img src={asset('/icone.svg')} alt="" width={42} height={42} />
        <p className="kicker">Área interna</p>
        <h1>Entrar no hub</h1>
        {desafio ? (
          <label>Código do autenticador
            <input className="campo" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          </label>
        ) : (
          <>
            <label>E-mail
              <input className="campo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>Senha
              <input className="campo" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </label>
          </>
        )}
        {erro && <p className="erro">{erro}</p>}
        <button className="btn" type="submit">{desafio ? 'Confirmar 2FA' : 'Entrar'}</button>
      </form>
    </main>
  );
}
