import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { descreverConfiguracao, ErroDeConfiguracao, lerConfiguracao, type Ambiente } from '../src/configuracao.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const APP = { GITHUB_ADAPTER: 'app', GITHUB_APP_ID: '5557350', GITHUB_APP_INSTALLATION_ID: '177273178' };

const ler = (env: Ambiente, arquivos: Record<string, string> = {}) => lerConfiguracao(env, {
  lerArquivo: (caminho) => {
    const conteudo = arquivos[caminho];
    if (conteudo === undefined) throw new Error(`ENOENT: ${caminho}`);
    return conteudo;
  },
});

describe('lerConfiguracao', () => {
  it('ambiente vazio sobe em memória, com o fake do GitHub e dados de exemplo', () => {
    const { configuracao, avisos } = ler({});
    expect(configuracao).toMatchObject({ porta: 3333, persistencia: 'memory', semearExemplo: true, github: { adapter: 'fake' }, thumdra: null, adminInicial: null });
    expect(configuracao.corsOrigens).toContain('http://localhost:3000');
    expect(avisos).toEqual([]);
  });

  it('em produção com Prisma não semeia e deixa o GitHub desligado se ninguém escolheu', () => {
    const { configuracao, avisos } = ler({ NODE_ENV: 'production', PERSISTENCIA: 'prisma' });
    expect(configuracao.semearExemplo).toBe(false);
    expect(configuracao.github.adapter).toBe('desligado');
    expect(avisos.join(' ')).toMatch(/GITHUB_ADAPTER vazio/);
  });

  it('não deixa o fake do GitHub gravar números de issue num banco de verdade', () => {
    const { configuracao, avisos } = ler({ TAREFAS_REPO: 'prisma', GITHUB_ADAPTER: 'fake' });
    expect(configuracao.persistencia).toBe('prisma');
    expect(configuracao.github.adapter).toBe('desligado');
    expect(avisos.join(' ')).toMatch(/fake não grava/);
  });

  it('nome de adapter desconhecido desliga o GitHub e diz o nome', () => {
    const { configuracao, avisos } = ler({ GITHUB_ADAPTER: 'http' });
    expect(configuracao.github.adapter).toBe('desligado');
    expect(avisos.join(' ')).toContain('"http"');
  });

  it('lê a chave do App em arquivo, base64 ou texto com \\n literal', () => {
    const porArquivo = ler({ ...APP, GITHUB_APP_PRIVATE_KEY_PATH: '/chave.pem' }, { '/chave.pem': PEM });
    const porBase64 = ler({ ...APP, GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from(PEM).toString('base64') });
    const umaLinha = ler({ ...APP, GITHUB_APP_PRIVATE_KEY: PEM.trim().replace(/\n/g, '\\n') });
    for (const { configuracao } of [porArquivo, porBase64, umaLinha]) {
      expect(configuracao.github).toMatchObject({ adapter: 'app', appId: '5557350', installationId: '177273178' });
    }
  });

  it('arquivo de chave ilegível cai para o base64 e avisa', () => {
    const { configuracao, avisos } = ler({ ...APP, GITHUB_APP_PRIVATE_KEY_PATH: '/sumiu.pem', GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from(PEM).toString('base64') });
    expect(configuracao.github.adapter).toBe('app');
    expect(avisos.join(' ')).toMatch(/sumiu\.pem.*não pôde ser lido/);
  });

  it('App incompleto ou com chave inválida desliga o GitHub dizendo o que falta', () => {
    const semInstalacao = ler({ GITHUB_ADAPTER: 'app', GITHUB_APP_ID: '1', GITHUB_APP_PRIVATE_KEY: PEM });
    expect(semInstalacao.configuracao.github.adapter).toBe('desligado');
    expect(semInstalacao.avisos.join(' ')).toContain('GITHUB_APP_INSTALLATION_ID');
    const chaveRuim = ler({ ...APP, GITHUB_APP_PRIVATE_KEY: 'nao-e-uma-chave' });
    expect(chaveRuim.configuracao.github.adapter).toBe('desligado');
    expect(chaveRuim.avisos.join(' ')).toMatch(/não é uma chave privada válida/);
  });

  it('recusa persistência, porta e SEED_EXEMPLO inválidos em vez de cair no padrão', () => {
    const erro = (() => {
      try {
        ler({ PERSISTENCIA: 'postgres', PORT: 'abc', SEED_EXEMPLO: 'sim' });
        return null;
      } catch (falha) {
        return falha;
      }
    })();
    expect(erro).toBeInstanceOf(ErroDeConfiguracao);
    expect((erro as ErroDeConfiguracao).problemas).toHaveLength(3);
  });

  it('separa as origens do CORS e ignora vazias', () => {
    expect(ler({ CORS_ORIGINS: ' https://splsolucoes.com , ,http://localhost:3000' }).configuracao.corsOrigens)
      .toEqual(['https://splsolucoes.com', 'http://localhost:3000']);
  });

  it('admin inicial e Thumdra só ligam com todas as partes', () => {
    const completo = ler({ BOOTSTRAP_ADMIN_EMAIL: ' Admin@SPLsolucoes.com ', BOOTSTRAP_ADMIN_SENHA: 'segredo' });
    expect(completo.configuracao.adminInicial).toEqual({ email: 'admin@splsolucoes.com', senha: 'segredo', nome: 'Admin SPL' });
    const parcial = ler({ BOOTSTRAP_ADMIN_EMAIL: 'admin@splsolucoes.com', THUMDRA_ADMIN_URL: 'https://thumdra.test' });
    expect(parcial.configuracao.adminInicial).toBeNull();
    expect(parcial.configuracao.thumdra).toBeNull();
    expect(parcial.avisos).toHaveLength(2);
  });
});

describe('descreverConfiguracao', () => {
  it('resume o boot sem vazar segredos', () => {
    const { configuracao } = ler({
      ...APP, GITHUB_APP_PRIVATE_KEY: PEM, GITHUB_WEBHOOK_SECRET: 'segredo-webhook', PAGES_DISPATCH_TOKEN: 'token-pages', PAGES_DISPATCH_REPOSITORIO: 'spl/hub',
      THUMDRA_ADMIN_URL: 'https://thumdra.test', THUMDRA_CLIENT_ID: 'id', THUMDRA_CLIENT_SECRET: 'segredo-thumdra', BOOTSTRAP_ADMIN_EMAIL: 'a@b.com', BOOTSTRAP_ADMIN_SENHA: 'senha-admin',
    });
    const resumo = descreverConfiguracao(configuracao);
    expect(resumo).toContain('github=app');
    for (const segredo of ['BEGIN RSA', 'segredo-webhook', 'token-pages', 'segredo-thumdra', 'senha-admin']) expect(resumo).not.toContain(segredo);
  });
});
