import { MAPA_VIEWBOX } from './brasil';

export function projetar(lat: number, lon: number) {
  const { w, h, minLon, maxLon, minLat, maxLat } = MAPA_VIEWBOX;
  return {
    x: ((lon - minLon) / (maxLon - minLon)) * w,
    y: ((maxLat - lat) / (maxLat - minLat)) * h,
  };
}

export function desprojetar(x: number, y: number) {
  const { w, h, minLon, maxLon, minLat, maxLat } = MAPA_VIEWBOX;
  return {
    lon: minLon + (x / w) * (maxLon - minLon),
    lat: maxLat - (y / h) * (maxLat - minLat),
  };
}

export const CIDADES: Record<string, { lat: number; lon: number }> = {
  'São Paulo': { lat: -23.55, lon: -46.63 },
  'Belo Horizonte': { lat: -19.92, lon: -43.94 },
  Curitiba: { lat: -25.43, lon: -49.27 },
  'Rio Verde': { lat: -17.79, lon: -50.92 },
  Brasília: { lat: -15.79, lon: -47.88 },
  Salvador: { lat: -12.97, lon: -38.5 },
  Recife: { lat: -8.05, lon: -34.88 },
  'Porto Alegre': { lat: -30.03, lon: -51.23 },
  Cuiabá: { lat: -15.6, lon: -56.1 },
  Manaus: { lat: -3.12, lon: -60.02 },
  Fortaleza: { lat: -3.73, lon: -38.52 },
  Goiânia: { lat: -16.69, lon: -49.25 },
};
