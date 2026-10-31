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
