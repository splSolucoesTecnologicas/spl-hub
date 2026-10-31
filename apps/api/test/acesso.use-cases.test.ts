import { describe, expect, it } from 'vitest';
import { codigoTotp } from '../src/modules/acesso/adapters/out/crypto.js';
import { permissoesPadrao } from '../src/modules/acesso/domain/usuario.js';
import { AGORA, memoria } from './memoria.js';

describe('Casos de uso de acesso', () => {
  it('entra com senha e abre sessão', async () => {
    const { acesso } = memoria();
    await acesso.criarUsuario({ nome: 'Segatto', email: 'segatto@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const sessao = await acesso.entrar({ email: 'segatto@splsolucoes.com', senha: 'SplExemplo#2026' });
    expect(sessao.requer2fa).toBe(false);
    if (!sessao.requer2fa) expect((await acesso.usuarioDoToken(sessao.token)).nome).toBe('Segatto');
  });

  it('exige TOTP válido antes da sessão', async () => {
    const { acesso, totp } = memoria();
    const segredo = totp.gerarSegredo();
    await acesso.criarUsuario({ nome: 'Lucas', email: 'lucas@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'colaborador', area: 'dev', totpSegredo: segredo, totpAtivo: true });
    const desafio = await acesso.entrar({ email: 'lucas@splsolucoes.com', senha: 'SplExemplo#2026' });
    expect(desafio.requer2fa).toBe(true);
    if (desafio.requer2fa) {
      await expect(acesso.confirmarTotp({ desafio: desafio.desafio, codigo: '000000' })).rejects.toThrow(/inválido/);
      const ok = await acesso.confirmarTotp({ desafio: desafio.desafio, codigo: codigoTotp(segredo, AGORA) });
      expect(ok.requer2fa).toBe(false);
    }
  });

  it('admin edita permissão e colaborador não ganha Sócios', async () => {
    const { acesso } = memoria();
    const admin = await acesso.criarUsuario({ nome: 'Admin', email: 'admin@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'socio', area: 'dev', admin: true });
    const lucas = await acesso.criarUsuario({ nome: 'Lucas', email: 'lucas@splsolucoes.com', senha: 'SplExemplo#2026', vinculo: 'colaborador', area: 'dev' });
    const permissoes = permissoesPadrao('colaborador');
    permissoes.blog = { nivel: 'editar', extraAte: null };
    const atualizado = await acesso.atualizarUsuario(admin, lucas.id, { permissoes, area: 'marketing' });
    expect(atualizado.area).toBe('marketing');
    expect(atualizado.permissoes.blog.nivel).toBe('editar');
    permissoes.socios = { nivel: 'ler', extraAte: null };
    await expect(acesso.atualizarUsuario(admin, lucas.id, { permissoes })).rejects.toThrow(/sócio/);
  });
});
