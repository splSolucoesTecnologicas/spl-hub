import { describe, expect, it, vi } from 'vitest';
import type { UsuarioDTO } from '@spl/contracts';
import type { Requisicao, Transporte } from './api';
import { criarDados, ErroDeContrato, nomeDaPessoa } from './dados';

const AGORA = '2026-11-06T12:00:00.000Z';

function pessoa(numero: number, nome = `Pessoa ${numero}`): UsuarioDTO {
  return {
    id: `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`, nome, email: `pessoa${numero}@splsolucoes.com`, vinculo: 'colaborador', area: 'dev',
    papeis: [], cidade: null, uf: null, latitude: null, longitude: null, ativo: true, admin: false, totpAtivo: false, permissoes: {},
    layoutInicio: null, frentes: [], exemplo: false, ultimoAcesso: null,
  };
}

/** Transporte em memória: responde por "MÉTODO caminho" e guarda o que foi pedido. */
function emMemoria(respostas: Record<string, unknown | ((requisicao: Requisicao) => unknown)>) {
  const pedidos: Requisicao[] = [];
  const transporte: Transporte = async (requisicao) => {
    pedidos.push(requisicao);
    const resposta = respostas[`${requisicao.metodo} ${requisicao.caminho}`];
    if (resposta === undefined) throw new Error(`sem resposta para ${requisicao.metodo} ${requisicao.caminho}`);
    return typeof resposta === 'function' ? resposta(requisicao) : structuredClone(resposta);
  };
  return { transporte, pedidos };
}

describe('dados', () => {
  it('segue o cursor até a última página', async () => {
    const { transporte, pedidos } = emMemoria({
      'GET /acesso/usuarios?limite=100': { data: [pessoa(1)], nextCursor: 'c1' },
      'GET /acesso/usuarios?limite=100&cursor=c1': { data: [pessoa(2)], nextCursor: null },
    });
    const dados = criarDados({ transporte, estrito: true });
    expect((await dados.pessoas.listar()).map((item) => item.nome)).toEqual(['Pessoa 1', 'Pessoa 2']);
    expect(pedidos).toHaveLength(2);
  });

  it('guarda pessoas em cache e esquece depois de uma mudança', async () => {
    const { transporte, pedidos } = emMemoria({
      'GET /acesso/usuarios?limite=100': { data: [pessoa(1)], nextCursor: null },
      'PATCH /acesso/usuarios/00000000-0000-4000-8000-000000000001': pessoa(1, 'Nome Novo'),
    });
    const dados = criarDados({ transporte, estrito: true });
    await Promise.all([dados.pessoas.listar(), dados.pessoas.listar()]);
    await dados.pessoas.listar();
    expect(pedidos).toHaveLength(1);
    await dados.pessoas.atualizar(pessoa(1).id, { nome: 'Nome Novo' });
    await dados.pessoas.listar();
    expect(pedidos.filter((pedido) => pedido.metodo === 'GET')).toHaveLength(2);
  });

  it('o cache vence com o tempo e não guarda falha', async () => {
    let agora = 0;
    let falhar = true;
    const { transporte, pedidos } = emMemoria({
      'GET /clientes?limite=100': () => {
        if (falhar) throw new Error('rede caiu');
        return { data: [], nextCursor: null };
      },
    });
    const dados = criarDados({ transporte, estrito: true, validadeDoCache: 1000, agora: () => agora });
    await expect(dados.clientes.listar()).rejects.toThrow('rede caiu');
    falhar = false;
    await dados.clientes.listar();
    agora = 999;
    await dados.clientes.listar();
    agora = 2000;
    await dados.clientes.listar();
    expect(pedidos).toHaveLength(3);
  });

  it('resposta fora do contrato lança no modo estrito e passa com aviso fora dele', async () => {
    const respostas = { 'GET /projetos/p1': { id: 'p1', nome: 'Sem o resto' } };
    await expect(criarDados({ transporte: emMemoria(respostas).transporte, estrito: true }).projetos.obter('p1')).rejects.toThrow(ErroDeContrato);
    const console = vi.spyOn(globalThis.console, 'error').mockImplementation(() => undefined);
    const projeto = await criarDados({ transporte: emMemoria(respostas).transporte, estrito: false }).projetos.obter('p1');
    expect(projeto.nome).toBe('Sem o resto');
    expect(console).toHaveBeenCalledWith(expect.stringContaining('GET /projetos/p1 fora do contrato'));
    console.mockRestore();
  });

  it('lê listas no formato { data } e listas puras', async () => {
    const { transporte } = emMemoria({
      'GET /decisoes': { data: [{ id: pessoa(9).id, titulo: 'Usar Dokploy', detalhe: '', quando: AGORA, autorId: pessoa(1).id, criadoEm: AGORA }] },
      'GET /projetos/github/repositorios': [{ owner: 'spl', nome: 'hub' }],
    });
    const dados = criarDados({ transporte, estrito: true });
    expect((await dados.decisoes.listar())[0]?.titulo).toBe('Usar Dokploy');
    expect(await dados.github.repositorios()).toEqual([{ owner: 'spl', nome: 'hub' }]);
  });

  it('status do GitHub sem resposta aparece como não conectado', async () => {
    const dados = criarDados({ transporte: emMemoria({}).transporte, estrito: true });
    expect(await dados.github.status()).toEqual({ conectado: false, organizacao: null });
  });
});

describe('nomeDaPessoa', () => {
  const pessoas = [pessoa(1, 'Eduardo Barbosa')];
  it('distingue ninguém de pessoa removida', () => {
    expect(nomeDaPessoa(pessoas, null)).toBe('—');
    expect(nomeDaPessoa(pessoas, 'sumiu')).toBe('pessoa removida');
    expect(nomeDaPessoa(pessoas, pessoa(1).id, 'curto')).toBe('Eduardo');
  });
});
