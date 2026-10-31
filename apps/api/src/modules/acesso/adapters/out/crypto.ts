import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Senhas, Tokens, TotpPort } from '../../application/ports.js';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodificarBase32(entrada: string): Buffer {
  const limpo = entrada.replace(/=+$/g, '').toUpperCase().replace(/\s/g, '');
  let bits = '';
  for (const caractere of limpo) {
    const valor = ALFABETO.indexOf(caractere);
    if (valor < 0) throw new Error('base32 inválido');
    bits += valor.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function codificarBase32(dados: Buffer): string {
  let bits = '';
  for (const byte of dados) bits += byte.toString(2).padStart(8, '0');
  let saida = '';
  for (let i = 0; i < bits.length; i += 5) {
    const pedaco = bits.slice(i, i + 5).padEnd(5, '0');
    saida += ALFABETO[Number.parseInt(pedaco, 2)];
  }
  return saida;
}

export function codigoTotp(segredo: string, agora: Date, passo = 30): string {
  const contador = Math.floor(agora.getTime() / 1000 / passo);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac('sha1', decodificarBase32(segredo)).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binario = hmac.readUInt32BE(offset) & 0x7fffffff;
  return (binario % 1_000_000).toString().padStart(6, '0');
}

function scryptAsync(senha: string, salt: Buffer, tamanho: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, salt, tamanho, (erro, chave) => (erro ? reject(erro) : resolve(chave)));
  });
}

export const senhas: Senhas = {
  async hash(senha: string) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(senha, salt, 32);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  },
  async confere(senha: string, armazenada: string) {
    const [, saltHex, hashHex] = armazenada.split('$');
    if (!saltHex || !hashHex) return false;
    const hash = await scryptAsync(senha, Buffer.from(saltHex, 'hex'), 32);
    const alvo = Buffer.from(hashHex, 'hex');
    if (hash.length !== alvo.length) return false;
    return timingSafeEqual(hash, alvo);
  },
};

export const totp: TotpPort = {
  gerarSegredo: () => codificarBase32(randomBytes(20)),
  uri: (email, segredo) => `otpauth://totp/SPL:${encodeURIComponent(email)}?secret=${segredo}&issuer=SPL&algorithm=SHA1&digits=6&period=30`,
  confere: (segredo, codigo, agora) => {
    const limpo = codigo.replace(/\s/g, '');
    return [-1, 0, 1].some((delta) => codigoTotp(segredo, new Date(agora.getTime() + delta * 30_000)) === limpo);
  },
};

export const tokens: Tokens = {
  novo: () => randomBytes(32).toString('hex'),
  hash: (token) => createHash('sha256').update(token).digest('hex'),
};
