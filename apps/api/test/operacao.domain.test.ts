import { describe, expect, it } from 'vitest';
import { geocodificar } from '@spl/contracts';
import { Cliente } from '../src/modules/operacao/domain/cliente.js';
import { Projeto } from '../src/modules/operacao/domain/projeto.js';
import { memoria } from './memoria.js';

const AGORA = new Date('2026-10-31T12:00:00.000Z');

describe('Cliente e projeto', () => {
  it('recusa nome curto e coordenada inválida', () => {
    const base = { id: '00000000-0000-4000-8000-000000000099', cidade: 'São Paulo', uf: 'SP', latitude: -23.55, longitude: -46.63, status: 'Ativo', agora: AGORA };
    expect(() => Cliente.criar({ ...base, nome: 'A' })).toThrow(/Nome/);
    expect(() => Cliente.criar({ ...base, nome: 'Costa', latitude: 120 })).toThrow(/[Ll]atitude/);
  });

  it('geocodifica São Paulo', () => {
    expect(geocodificar('São Paulo', 'SP')?.lat).toBeCloseTo(-23.55, 1);
  });

  it('recusa repositório sem dono/nome', () => {
    expect(() => Projeto.criar({
      id: '00000000-0000-4000-8000-000000000098', nome: 'Thumdra', tipo: 'produto', status: 'piloto', cor: '#4c8dff', repositorio: 'thumdra', agora: AGORA,
    })).toThrow(/Repositório/);
  });
});

describe('Exclusão de pessoas', () => {
  it('não deixa excluir a si mesmo nem o último admin', async () => {
    const { acesso } = memoria();
    const admin = await acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const outro = await acesso.criarUsuario({ nome: 'Outro Admin', email: 'outro@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    await expect(acesso.excluirUsuario(admin, admin.id)).rejects.toThrow(/si mesmo/);
    await acesso.atualizarUsuario(admin, outro.id, { ativo: false });
    await expect(acesso.excluirUsuario(outro, admin.id)).rejects.toThrow(/último admin/);
  });
});
