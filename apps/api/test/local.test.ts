import { describe, expect, it } from 'vitest';
import { geocodificar, resolverCoordenada } from '@spl/contracts';
import { criarCasosDeUsoOperacao } from '../src/modules/operacao/application/use-cases.js';
import { memoria } from './memoria.js';

const RECIFE = geocodificar('Recife', 'PE')!;
const SAO_PAULO = geocodificar('São Paulo', 'SP')!;

describe('resolverCoordenada', () => {
  it('coordenada informada vence; sem ela vale o centro da cidade; cidade desconhecida não vira ponto', () => {
    expect(resolverCoordenada({ cidade: 'Recife', uf: 'PE', latitude: -8, longitude: -34.9 })).toEqual({ latitude: -8, longitude: -34.9, origem: 'exata' });
    expect(resolverCoordenada({ cidade: 'Recife', uf: 'PE' })).toMatchObject({ latitude: RECIFE.lat, origem: 'centro_da_cidade' });
    expect(resolverCoordenada({ cidade: 'Cidade Que Não Existe', uf: 'XX' })).toBeNull();
    expect(resolverCoordenada({})).toBeNull();
  });
});

describe('Local de pessoas e clientes', () => {
  it('pessoa que troca de cidade sem coordenada nova perde a coordenada da cidade antiga', async () => {
    const { acesso } = memoria();
    const admin = await acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const lucas = await acesso.criarUsuario({
      nome: 'Lucas', email: 'lucas@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'colaborador', area: 'dev',
      cidade: 'São Paulo', uf: 'SP', latitude: -23.6, longitude: -46.7,
    });
    const mesmoLugar = await acesso.atualizarUsuario(admin, lucas.id, { cidade: 'São Paulo', uf: 'SP', area: 'marketing' });
    expect(mesmoLugar.latitude).toBe(-23.6);
    const mudou = await acesso.atualizarUsuario(admin, lucas.id, { cidade: 'Recife', uf: 'PE' });
    expect(mudou.latitude).toBeNull();
    expect(resolverCoordenada(mudou)).toMatchObject({ latitude: RECIFE.lat, origem: 'centro_da_cidade' });
  });

  it('cliente mantém o ponto exato ao editar outro campo e vai ao centro da nova cidade ao mudar', async () => {
    const deps = memoria();
    const admin = await deps.acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const operacao = criarCasosDeUsoOperacao(deps);
    const cliente = await operacao.criarCliente(admin, { nome: 'Costa', cidade: 'São Paulo', uf: 'SP', latitude: -23.6, longitude: -46.7, status: 'Ativo' });
    expect((await operacao.atualizarCliente(admin, cliente.id, { cidade: 'São Paulo', status: 'Pausado' })).latitude).toBe(-23.6);
    const mudou = await operacao.atualizarCliente(admin, cliente.id, { cidade: 'Recife', uf: 'PE' });
    expect([mudou.latitude, mudou.longitude]).toEqual([RECIFE.lat, RECIFE.lon]);
    expect(SAO_PAULO.lat).not.toBe(RECIFE.lat);
    await expect(operacao.criarCliente(admin, { nome: 'Sem lugar', cidade: 'Cidade Que Não Existe', uf: 'XX', status: 'Ativo' })).rejects.toThrow(/Cidade não reconhecida/);
  });
});
