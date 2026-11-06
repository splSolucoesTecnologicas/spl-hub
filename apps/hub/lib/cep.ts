import { resolverCoordenada, type CidadeGeo } from '@spl/contracts';

export interface EnderecoCep {
  cidade: CidadeGeo;
  rua: string | null;
  bairro: string | null;
  /** CEP sem rua cobre o município inteiro: o ponto cai no centro da cidade. */
  municipioInteiro: boolean;
}

/** Seam da consulta: a BrasilAPI em produção, uma tabela fixa nos testes. */
export type ConsultaCep = (digitos: string) => Promise<{ ok: boolean; corpo: unknown }>;

/** Resposta da BrasilAPI v2. `location` pode vir vazio e o corpo pode ser um erro. */
interface RespostaCep {
  state?: string;
  city?: string;
  neighborhood?: string | null;
  street?: string | null;
  location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
  name?: string;
}

export const consultaBrasilApi: ConsultaCep = async (digitos) => {
  const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`);
  return { ok: resposta.ok, corpo: await resposta.json().catch(() => null) };
};

export function soDigitosDoCep(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 8);
}

export function formatarCep(digitos: string): string {
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

function numero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

export async function buscarEnderecoPorCep(cep: string, consultar: ConsultaCep = consultaBrasilApi): Promise<EnderecoCep> {
  const digitos = soDigitosDoCep(cep);
  if (digitos.length !== 8) throw new Error('O CEP precisa de 8 dígitos.');
  const { ok, corpo } = await consultar(digitos);
  const resposta = (corpo ?? {}) as RespostaCep;
  if (!ok || resposta.name || !resposta.city || !resposta.state) throw new Error('CEP não encontrado.');
  // Sem coordenada na base do CEP, a regra do contrato cai no centro da cidade.
  const ponto = resolverCoordenada({
    cidade: resposta.city,
    uf: resposta.state,
    latitude: numero(resposta.location?.coordinates?.latitude),
    longitude: numero(resposta.location?.coordinates?.longitude),
  });
  if (!ponto) throw new Error('CEP sem coordenada conhecida. Use a busca por cidade.');
  return {
    cidade: { nome: resposta.city, uf: resposta.state, lat: ponto.latitude, lon: ponto.longitude },
    rua: resposta.street ?? null,
    bairro: resposta.neighborhood ?? null,
    municipioInteiro: !resposta.street,
  };
}
