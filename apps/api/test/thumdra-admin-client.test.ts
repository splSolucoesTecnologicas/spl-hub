import { describe, expect, it } from 'vitest';
import { FakeThumdraAdminClient } from '../src/integrations/thumdra/fake-thumdra-admin-client.js';

describe('ThumdraAdminClient (fake)', () => {
  it('desativa com idempotência e auditoria', async () => {
    const cliente = new FakeThumdraAdminClient();
    await cliente.desativarUsuario('u1', 'segatto', 'k1');
    await cliente.desativarUsuario('u1', 'segatto', 'k1');
    expect(cliente.auditoria).toHaveLength(1);
    const pagina = await cliente.listarUsuarios({}, 'segatto');
    expect(pagina.data.find((usuario) => usuario.id === 'u1')?.ativo).toBe(false);
  });
});
