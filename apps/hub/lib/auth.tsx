'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, type UsuarioDTO } from './api';
import { apagarSessao, lerSessao } from './sessao';

interface Sessao {
  usuario: UsuarioDTO;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioDTO | null>(null);

  async function carregar() {
    const token = lerSessao();
    if (!token) { router.replace('/login'); return; }
    try { setUsuario(await api<UsuarioDTO>('/acesso/eu')); }
    catch { apagarSessao(); router.replace('/login'); }
  }

  useEffect(() => { void carregar(); }, []);

  if (!usuario) return <div className="boot">Abrindo o hub…</div>;

  return (
    <Ctx.Provider value={{
      usuario,
      recarregar: carregar,
      sair: async () => {
        await api('/acesso/logout', { method: 'POST' }).catch(() => undefined);
        apagarSessao();
        router.replace('/login');
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSessao() {
  const sessao = useContext(Ctx);
  if (!sessao) throw new Error('Sessão indisponível');
  return sessao;
}
