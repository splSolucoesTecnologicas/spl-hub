export interface CidadeGeo { nome: string; uf: string; lat: number; lon: number }
export function geocodificar(cidade: string, uf?: string | null): CidadeGeo | null;
export function listarCidades(termo?: string): CidadeGeo[];
