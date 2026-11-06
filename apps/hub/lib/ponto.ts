import { resolverCoordenada, type CidadeGeo, type ClienteDTO, type Local, type ProjetoDTO, type UsuarioDTO } from '@spl/contracts';
import { MAPA_VIEWBOX } from './brasil';
import { primeiroNome } from './dados';

const COR_EQUIPE = '#00ff66';
const COR_CLIENTE_SEM_PROJETO = '#8ba3b8';

export function projetar(lat: number, lon: number) {
  const { w, h, minLon, maxLon, minLat, maxLat } = MAPA_VIEWBOX;
  return {
    x: ((lon - minLon) / (maxLon - minLon)) * w,
    y: ((maxLat - lat) / (maxLat - minLat)) * h,
  };
}

/** Ponto no Radar pela regra do contrato: coordenada exata, senão o centro da cidade. */
export function pontoNoRadar(local: Local): { x: number; y: number } | null {
  const coordenada = resolverCoordenada(local);
  return coordenada ? projetar(coordenada.latitude, coordenada.longitude) : null;
}

/** O que gravar quando alguém escolhe uma cidade, pelo seletor ou pelo CEP. */
export function localDaCidade(cidade: CidadeGeo): { cidade: string; uf: string; latitude: number; longitude: number } {
  return { cidade: cidade.nome, uf: cidade.uf, latitude: cidade.lat, longitude: cidade.lon };
}

export function projetoDoCliente(projetos: readonly ProjetoDTO[], clienteId: string): ProjetoDTO | undefined {
  return projetos.find((projeto) => projeto.clienteIds.includes(clienteId));
}

export interface RadarEntrada {
  pessoas: readonly UsuarioDTO[];
  clientes: readonly ClienteDTO[];
  projetos: readonly ProjetoDTO[];
  /** 'todos', 'equipe', 'clientes' ou o id de um projeto. */
  filtro: string;
}

/** Um marcador por pessoa e por cliente visível no filtro, já espalhados quando dividem o mesmo lugar. */
export function marcadoresDoRadar({ pessoas, clientes, projetos, filtro }: RadarEntrada): Marcador[] {
  const lista: Marcador[] = [];
  if (filtro === 'todos' || filtro === 'equipe') {
    for (const pessoa of pessoas) {
      const ponto = pontoNoRadar(pessoa);
      if (ponto) lista.push({ id: `p-${pessoa.id}`, x: ponto.x, y: ponto.y, dx: 0, dy: 0, cor: COR_EQUIPE, nome: primeiroNome(pessoa.nome), tipo: 'equipe' });
    }
  }
  for (const cliente of clientes) {
    const projeto = projetoDoCliente(projetos, cliente.id);
    if (filtro !== 'todos' && filtro !== 'clientes' && filtro !== projeto?.id) continue;
    const ponto = pontoNoRadar(cliente);
    if (ponto) lista.push({ id: `c-${cliente.id}`, x: ponto.x, y: ponto.y, dx: 0, dy: 0, cor: projeto?.cor ?? COR_CLIENTE_SEM_PROJETO, nome: cliente.nome, tipo: 'cliente', alvo: cliente.id });
  }
  return espalharColididos(lista);
}

/** Quem divide a mesma cidade ganha um lugar proprio num anelzinho — um ponto por pessoa. */
function espalharColididos(lista: Marcador[]) {
  const grupos = new Map<string, Marcador[]>();
  for (const item of lista) {
    const chave = `${item.x.toFixed(1)},${item.y.toFixed(1)}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(item);
    else grupos.set(chave, [item]);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const raio = 4.2 + (grupo.length - 2) * 0.85;
    grupo.forEach((item, indice) => {
      const angulo = (indice / grupo.length) * Math.PI * 2 - Math.PI / 2;
      item.dx = Math.cos(angulo) * raio;
      item.dy = Math.sin(angulo) * raio;
    });
  }
  return lista;
}

const ALTURA_ROTULO = 13;
const DESVIOS = [0, -ALTURA_ROTULO, ALTURA_ROTULO, -26, 26, -39, 39, -52, 52];

export type Marcador = { id: string; x: number; y: number; dx: number; dy: number; cor: string; nome: string; tipo: 'equipe' | 'cliente'; alvo?: string };
export type Vista = { k: number; x: number; y: number };

/** Posiciona os rotulos em volta dos pontos sem deixar nenhum encostar no outro. */
export function montarRotulos(marcadores: Marcador[], vista: Vista, mostrarClientes: boolean) {
  const ocupados: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const saida: (Marcador & { sx: number; sy: number; rx: number; ry: number; desvio: number; largura: number; esquerda: boolean })[] = [];
  const visiveis = marcadores
    .filter((item) => item.tipo === 'equipe' || mostrarClientes)
    .map((item) => ({ ...item, sx: item.x * vista.k + vista.x + item.dx, sy: item.y * vista.k + vista.y + item.dy }))
    .filter((item) => item.sx > -40 && item.sx < 680 && item.sy > -20 && item.sy < 660)
    .sort((a, b) => a.sy - b.sy);
  for (const item of visiveis) {
    const largura = item.nome.length * 5.3 + 8;
    const esquerda = item.sx > 520;
    for (const desvio of DESVIOS) {
      const ry = item.sy + 3.4 + desvio;
      const rx = esquerda ? item.sx - 7 - largura : item.sx + 7;
      const caixa = { x1: rx - 3, y1: ry - 9.5, x2: rx + largura, y2: ry + 4 };
      const bate = ocupados.some((c) => caixa.x1 < c.x2 && caixa.x2 > c.x1 && caixa.y1 < c.y2 && caixa.y2 > c.y1);
      if (bate) continue;
      ocupados.push(caixa);
      saida.push({ ...item, rx, ry, desvio, largura, esquerda });
      break;
    }
  }
  return saida;
}
