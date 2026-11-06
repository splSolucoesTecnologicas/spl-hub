import { describe, expect, it } from 'vitest';
import { geocodificar } from '@spl/contracts';
import { buscarEnderecoPorCep, type ConsultaCep } from './cep';

const RECIFE = geocodificar('Recife', 'PE')!;

/** Tabela fixa no lugar da BrasilAPI; CEP fora da tabela responde como a API responde a CEP inexistente. */
function tabela(respostas: Record<string, unknown>): ConsultaCep {
  return async (digitos) => (digitos in respostas
    ? { ok: true, corpo: respostas[digitos] }
    : { ok: false, corpo: { name: 'CepPromiseError', message: 'Todos os serviços de CEP retornaram erro.' } });
}

const consulta = tabela({
  '50030230': { state: 'PE', city: 'Recife', street: 'Avenida Rio Branco', neighborhood: 'Recife', location: { coordinates: { latitude: '-8.0631', longitude: '-34.8711' } } },
  '50000000': { state: 'PE', city: 'Recife', street: null, neighborhood: null, location: { coordinates: {} } },
  '50000001': { state: 'PE', city: 'Recife', street: 'Rua Sem Ponto', location: { coordinates: { latitude: '', longitude: '' } } },
  '99999999': { state: 'XX', city: 'Lugar Nenhum', street: null, location: {} },
});

describe('buscarEnderecoPorCep', () => {
  it('usa a coordenada da base do CEP e aceita CEP com máscara', async () => {
    const endereco = await buscarEnderecoPorCep('50030-230', consulta);
    expect(endereco).toEqual({ cidade: { nome: 'Recife', uf: 'PE', lat: -8.0631, lon: -34.8711 }, rua: 'Avenida Rio Branco', bairro: 'Recife', municipioInteiro: false });
  });

  it('CEP do município inteiro, sem coordenada, cai no centro da cidade', async () => {
    const endereco = await buscarEnderecoPorCep('50000000', consulta);
    expect([endereco.cidade.lat, endereco.cidade.lon]).toEqual([RECIFE.lat, RECIFE.lon]);
    expect(endereco.municipioInteiro).toBe(true);
  });

  it('coordenada vazia na resposta não vira o ponto 0,0', async () => {
    const endereco = await buscarEnderecoPorCep('50000001', consulta);
    expect(endereco.cidade.lat).toBe(RECIFE.lat);
  });

  it('recusa CEP curto, inexistente ou sem ponto conhecido', async () => {
    await expect(buscarEnderecoPorCep('123', consulta)).rejects.toThrow('8 dígitos');
    await expect(buscarEnderecoPorCep('01001000', consulta)).rejects.toThrow('CEP não encontrado.');
    await expect(buscarEnderecoPorCep('99999999', consulta)).rejects.toThrow(/sem coordenada/);
  });
});
