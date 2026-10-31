import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { gerarJwtApp } from '../src/modules/tarefas/adapters/out/github-cliente.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

describe('gerarJwtApp', () => {
  it('gera um JWT com 3 partes assinado em RS256', () => {
    const token = gerarJwtApp('123', pem, 1_700_000_000);
    const partes = token.split('.');
    expect(partes).toHaveLength(3);
    const cabecalho = JSON.parse(Buffer.from(partes[0]!, 'base64url').toString());
    expect(cabecalho).toEqual({ alg: 'RS256', typ: 'JWT' });
    const corpo = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString());
    expect(corpo.iss).toBe('123');
    expect(corpo.exp - corpo.iat).toBe(630);
  });
});
