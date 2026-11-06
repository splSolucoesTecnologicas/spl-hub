import { describe, expect, it } from 'vitest';
import { geocodificar, type ClienteDTO, type ProjetoDTO, type UsuarioDTO } from '@spl/contracts';
import { marcadoresDoRadar, montarRotulos, pontoNoRadar, projetar } from './ponto';

const RECIFE = geocodificar('Recife', 'PE')!;
const AGORA = '2026-11-06T12:00:00.000Z';

function pessoa(id: string, nome: string, local: Pick<UsuarioDTO, 'cidade' | 'uf' | 'latitude' | 'longitude'>): UsuarioDTO {
  return {
    id, nome, email: `${id}@splsolucoes.com`, vinculo: 'colaborador', area: 'dev', papeis: [], ...local, ativo: true, admin: false,
    totpAtivo: false, permissoes: {}, layoutInicio: null, frentes: [], exemplo: false, ultimoAcesso: null,
  };
}

function cliente(id: string, nome: string): ClienteDTO {
  return {
    id, nome, cidade: 'Recife', uf: 'PE', latitude: -8.05, longitude: -34.9, status: 'Ativo', responsavelId: null, ultimoContato: null,
    observacoes: '', criadoEm: AGORA, atualizadoEm: AGORA,
  };
}

function projeto(id: string, clienteIds: string[], cor: string): ProjetoDTO {
  return {
    id, nome: id, tipo: 'produto', status: 'piloto', descricao: '', cor, repositorio: null, quadroUrl: null, adminUrl: null, githubProjectNumero: null,
    githubColunaMap: null, progresso: 0, progressoRotulo: '', responsaveis: [], clienteIds, marcos: [], criadoEm: AGORA, atualizadoEm: AGORA,
  };
}

const emRecife = { cidade: 'Recife', uf: 'PE', latitude: null, longitude: null };

describe('pontoNoRadar', () => {
  it('coordenada exata vence; sem ela vale o centro da cidade; cidade desconhecida fica fora do mapa', () => {
    expect(pontoNoRadar({ cidade: 'Recife', uf: 'PE', latitude: -8, longitude: -34.9 })).toEqual(projetar(-8, -34.9));
    expect(pontoNoRadar(emRecife)).toEqual(projetar(RECIFE.lat, RECIFE.lon));
    expect(pontoNoRadar({ cidade: 'Lugar Nenhum', uf: 'XX' })).toBeNull();
  });
});

describe('marcadoresDoRadar', () => {
  it('quem divide a cidade ganha um ponto próprio no anel', () => {
    const marcadores = marcadoresDoRadar({
      pessoas: [pessoa('a', 'Ana Souza', emRecife), pessoa('b', 'Bia Lima', emRecife), pessoa('c', 'Caio', { cidade: 'São Paulo', uf: 'SP', latitude: -23.6, longitude: -46.7 })],
      clientes: [], projetos: [], filtro: 'todos',
    });
    const [ana, bia, caio] = marcadores;
    expect(ana?.nome).toBe('Ana');
    expect([ana?.x, ana?.y]).toEqual([bia?.x, bia?.y]);
    expect([ana?.dx, ana?.dy]).not.toEqual([bia?.dx, bia?.dy]);
    expect([caio?.dx, caio?.dy]).toEqual([0, 0]);
  });

  it('filtro de projeto mostra só os clientes dele, na cor do projeto', () => {
    const entrada = {
      pessoas: [pessoa('a', 'Ana', emRecife)],
      clientes: [cliente('c1', 'Costa'), cliente('c2', 'Sem projeto')],
      projetos: [projeto('p1', ['c1'], '#ff0000')],
    };
    const doProjeto = marcadoresDoRadar({ ...entrada, filtro: 'p1' });
    expect(doProjeto.map((item) => [item.id, item.cor])).toEqual([['c-c1', '#ff0000']]);
    expect(marcadoresDoRadar({ ...entrada, filtro: 'equipe' }).map((item) => item.tipo)).toEqual(['equipe']);
    expect(marcadoresDoRadar({ ...entrada, filtro: 'clientes' })).toHaveLength(2);
  });
});

describe('montarRotulos', () => {
  it('rótulos de pontos vizinhos não se encostam e clientes só aparecem quando pedidos', () => {
    const marcadores = marcadoresDoRadar({
      pessoas: ['Ana', 'Bia', 'Caio', 'Duda'].map((nome) => pessoa(nome, nome, emRecife)),
      clientes: [cliente('c1', 'Costa')], projetos: [], filtro: 'todos',
    });
    const rotulos = montarRotulos(marcadores, { k: 1, x: 0, y: 0 }, false);
    expect(rotulos.map((item) => item.tipo)).not.toContain('cliente');
    const caixas = rotulos.map((item) => ({ x1: item.rx - 3, y1: item.ry - 9.5, x2: item.rx + item.largura, y2: item.ry + 4 }));
    caixas.forEach((caixa, i) => caixas.slice(i + 1).forEach((outra) => {
      const encosta = caixa.x1 < outra.x2 && caixa.x2 > outra.x1 && caixa.y1 < outra.y2 && caixa.y2 > outra.y1;
      expect(encosta).toBe(false);
    }));
    expect(montarRotulos(marcadores, { k: 1, x: 0, y: 0 }, true).map((item) => item.tipo)).toContain('cliente');
  });
});
