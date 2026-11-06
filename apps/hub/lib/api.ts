import { lerSessao } from './sessao';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export class ErroApi extends Error {
  constructor(mensagem: string, public readonly status: number) { super(mensagem); }
}

export interface Requisicao {
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  caminho: string;
  corpo?: unknown;
}

/** Seam do módulo de dados: o HTTP em produção, um transporte em memória nos testes. */
export type Transporte = (requisicao: Requisicao) => Promise<unknown>;

export const transporteHttp: Transporte = async ({ metodo, caminho, corpo }) => {
  const token = typeof window === 'undefined' ? null : lerSessao();
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    headers: {
      ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (resposta.status === 204) return undefined;
  const conteudo = await resposta.json().catch(() => ({})) as { title?: string; detail?: string };
  if (!resposta.ok) throw new ErroApi(conteudo.detail || conteudo.title || 'Falha na API', resposta.status);
  return conteudo;
};
