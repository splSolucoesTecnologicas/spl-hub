import { describe, expect, it } from 'vitest';
import { ErroDeDominio } from '../src/shared/domain/erro-de-dominio.js';
import { Usuario, permissoesPadrao } from '../src/modules/acesso/domain/usuario.js';

const base = { id: '00000000-0000-4000-8000-000000000001', nome: 'Ana', email: 'ana@splsolucoes.com', senhaHash: 'x', criadoEm: new Date() };

describe('Usuário (domínio)', () => {
  it('normaliza e-mail e nome', () => {
    const usuario = Usuario.criar({ ...base, nome: '  Ana  ', email: 'Ana@SPL.com', vinculo: 'socio', area: 'dev' });
    expect(usuario.email).toBe('ana@spl.com');
    expect(usuario.nome).toBe('Ana');
    expect(usuario.permissoes.socios.nivel).toBe('editar');
  });

  it('impede colaborador de receber o módulo Sócios', () => {
    const permissoes = permissoesPadrao('colaborador');
    permissoes.socios = { nivel: 'ler', extraAte: null };
    expect(() => Usuario.criar({ ...base, vinculo: 'colaborador', area: 'dev', permissoes })).toThrow(ErroDeDominio);
  });

  it('bloqueia depois de cinco falhas', () => {
    const usuario = Usuario.criar({ ...base, vinculo: 'socio', area: 'dev' });
    const agora = new Date('2026-10-30T12:00:00.000Z');
    for (let i = 0; i < 5; i++) usuario.registrarFalha(agora);
    expect(() => usuario.garantirNaoBloqueado(agora)).toThrow(/Muitas tentativas/);
    usuario.registrarSucesso(new Date(agora.getTime() + 16 * 60 * 1000));
    expect(usuario.tentativas).toBe(0);
  });
});
