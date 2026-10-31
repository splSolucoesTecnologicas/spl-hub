'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FormEvent, ReactNode, useState } from 'react';
import { asset } from '@/lib/base';
import { useSessao } from '@/lib/auth';

const ITENS = [
  ['/', 'Início'], ['/tarefas', 'Tarefas'], ['/projetos', 'Projetos'], ['/clientes', 'Clientes'],
  ['/reunioes', 'Reuniões'], ['/blog', 'Blog'], ['/podcast', 'Podcast'], ['/drive', 'Drive'],
  ['/time', 'Time'], ['/socios', 'Sócios'], ['/configuracoes', 'Configurações'],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { usuario, sair } = useSessao();
  const [busca, setBusca] = useState('');
  const [toast, setToast] = useState('');
  const iniciais = usuario.nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const achados = ITENS.filter(([, nome]) => nome.toLowerCase().includes(busca.trim().toLowerCase()));

  async function contexto(evento: FormEvent) {
    evento.preventDefault();
    const texto = [`# Contexto SPL Hub`, `Página: ${pathname}`, `Usuário: ${usuario.nome} (${usuario.email})`, `Vínculo: ${usuario.vinculo} · ${usuario.area}`, `Gerado localmente para colar no Claude. Não envia dados para fora do navegador.`].join('\n');
    await navigator.clipboard.writeText(texto);
    setToast('Contexto copiado');
    setTimeout(() => setToast(''), 2200);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="marca">
          <img src={asset('/icone.svg')} alt="" />
          <div><b>SPL HUB</b><span>SOLUÇÕES TECNOLÓGICAS</span></div>
        </div>
        <nav className="menu">
          {ITENS.map(([href, nome]) => (
            <Link key={href} href={href} className={pathname === href ? 'ativo' : undefined}>{nome}</Link>
          ))}
        </nav>
        <div className="eu">
          <div className="avatar">{iniciais}</div>
          <div>
            <strong>{usuario.nome}</strong>
            <div className="selos">{usuario.papeis.map((papel) => <span key={papel} className={`selo ${papel === 'Sócio' ? 'socio' : papel === 'Admin' ? 'admin' : 'dev'}`}>{papel}</span>)}</div>
            <button className="btn fantasma" type="button" onClick={() => void sair()} style={{ marginTop: 8, padding: '4px 8px' }}>Sair</button>
          </div>
        </div>
      </aside>
      <div className={pathname === '/' ? 'miolo cheio' : 'miolo'}>
        <header className={pathname === '/' ? 'topo sobre' : 'topo'}>
          <span>hub.splsolucoes.com · área interna</span>
          <form className="busca" onSubmit={(e) => e.preventDefault()}>
            <input aria-label="Buscar" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {busca && (
              <div className="painel" style={{ position: 'absolute', marginTop: 8 }}>
                {achados.map(([href, nome]) => <Link key={href} href={href} onClick={() => setBusca('')}>{nome}</Link>)}
                {achados.length === 0 && <span>Nenhuma área com esse nome</span>}
              </div>
            )}
          </form>
          <button className="btn" type="button" onClick={(e) => void contexto(e)}>+ Contexto para o Claude</button>
        </header>
        {children}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
