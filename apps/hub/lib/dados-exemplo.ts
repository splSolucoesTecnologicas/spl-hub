export type ProdutoCliente = 'thumdra' | 'corujuris' | 'sob_medida';

export interface ClienteExemplo {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  produto: ProdutoCliente;
  status: string;
  responsavel: string;
  contato: string;
  contrato?: string;
  frente?: string;
}

/** Quadro comercial de demonstração. Não vem da API: o módulo Clientes ainda é esboço. */
export const CLIENTES_EXEMPLO: ClienteExemplo[] = [
  { id: 'clinica-vida', nome: 'Clínica Vida', cidade: 'São Paulo', uf: 'SP', produto: 'thumdra', status: 'Ativo', responsavel: 'Eduardo', contato: '29/10' },
  { id: 'loja-bela', nome: 'Loja Bela', cidade: 'Belo Horizonte', uf: 'MG', produto: 'thumdra', status: 'Ativo', responsavel: 'Eduardo', contato: '28/10' },
  { id: 'escola-alfa', nome: 'Escola Alfa', cidade: 'Curitiba', uf: 'PR', produto: 'thumdra', status: 'Ativo', responsavel: 'Gul', contato: '25/10' },
  { id: 'agro-cerrado', nome: 'Agro Cerrado', cidade: 'Rio Verde', uf: 'GO', produto: 'thumdra', status: 'Trial', responsavel: 'Marco', contato: '27/10' },
  { id: 'silva', nome: 'Silva & Assoc.', cidade: 'Brasília', uf: 'DF', produto: 'corujuris', status: 'Ativo', responsavel: 'Segatto', contato: '29/10' },
  { id: 'rocha', nome: 'Rocha Jurídico', cidade: 'Salvador', uf: 'BA', produto: 'corujuris', status: 'Ativo', responsavel: 'Segatto', contato: '27/10' },
  { id: 'lima', nome: 'Lima Advocacia', cidade: 'Recife', uf: 'PE', produto: 'corujuris', status: 'Trial', responsavel: 'Sérgio', contato: '22/10' },
  { id: 'costa', nome: 'Costa Adv.', cidade: 'Porto Alegre', uf: 'RS', produto: 'corujuris', status: 'Inadimplente', responsavel: 'Segatto', contato: '29/10', contrato: 'Starter · exemplo', frente: 'Corujuris · Segatto' },
  { id: 'rurais', nome: 'Rurais · Fazenda Boa Vista', cidade: 'Cuiabá', uf: 'MT', produto: 'sob_medida', status: 'Piloto', responsavel: 'Edu', contato: '20/10' },
  { id: 'portal', nome: 'Portal Cooperativa', cidade: 'Manaus', uf: 'AM', produto: 'sob_medida', status: 'Em desenvolvimento', responsavel: 'Lucas', contato: '28/10' },
  { id: 'app', nome: 'App Distribuidora', cidade: 'Fortaleza', uf: 'CE', produto: 'sob_medida', status: 'Proposta', responsavel: 'Sérgio', contato: '18/10' },
];

export const DECISOES_EXEMPLO = [
  { titulo: 'Contratar proxy brasileiro (DJEN)', quando: '28/10' },
  { titulo: 'Hub em arquitetura hexagonal + TS', quando: '24/10' },
  { titulo: 'Aplicar no Claude for Startups', quando: '20/10' },
];

export const OBJETIVOS_EXEMPLO = [
  { titulo: 'Fechar 5 clientes pagantes no Thumdra', valor: 60 },
  { titulo: 'Corujuris: 3 escritórios em piloto', valor: 33 },
];

export const ROTULO_PRODUTO: Record<ProdutoCliente | 'equipe', string> = {
  equipe: 'Equipe', thumdra: 'Thumdra', corujuris: 'Corujuris', sob_medida: 'Sob medida',
};
