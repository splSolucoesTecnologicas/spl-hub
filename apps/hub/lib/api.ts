import type { AuditoriaDTO, NoticiaDTO, SolicitacaoAcessoDTO, TarefaDTO, UsuarioDTO } from '@spl/contracts';
import { lerSessao } from './sessao';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export class ErroApi extends Error {
  constructor(mensagem: string, public readonly status: number) { super(mensagem); }
}

export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = typeof window === 'undefined' ? null : lerSessao();
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      ...(opcoes.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opcoes.headers ?? {}),
    },
  });
  if (resposta.status === 204) return undefined as T;
  const corpo = await resposta.json().catch(() => ({})) as { title?: string; detail?: string };
  if (!resposta.ok) throw new ErroApi(corpo.detail || corpo.title || 'Falha na API', resposta.status);
  return corpo as T;
}

export type Pagina<T> = { data: T[]; nextCursor: string | null };
export type { AuditoriaDTO, NoticiaDTO, SolicitacaoAcessoDTO, TarefaDTO, UsuarioDTO };
