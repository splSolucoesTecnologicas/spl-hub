/** Capitais e cidades usadas no mapa. Coordenadas aproximadas, suficientes para o ponto. */
export const CIDADES_BRASIL = [
  { nome: 'Rio Branco', uf: 'AC', lat: -9.97, lon: -67.81 },
  { nome: 'Maceió', uf: 'AL', lat: -9.67, lon: -35.74 },
  { nome: 'Macapá', uf: 'AP', lat: 0.03, lon: -51.07 },
  { nome: 'Manaus', uf: 'AM', lat: -3.12, lon: -60.02 },
  { nome: 'Salvador', uf: 'BA', lat: -12.97, lon: -38.5 },
  { nome: 'Fortaleza', uf: 'CE', lat: -3.73, lon: -38.52 },
  { nome: 'Brasília', uf: 'DF', lat: -15.79, lon: -47.88 },
  { nome: 'Vitória', uf: 'ES', lat: -20.32, lon: -40.34 },
  { nome: 'Goiânia', uf: 'GO', lat: -16.69, lon: -49.25 },
  { nome: 'São Luís', uf: 'MA', lat: -2.53, lon: -44.3 },
  { nome: 'Cuiabá', uf: 'MT', lat: -15.6, lon: -56.1 },
  { nome: 'Campo Grande', uf: 'MS', lat: -20.44, lon: -54.65 },
  { nome: 'Belo Horizonte', uf: 'MG', lat: -19.92, lon: -43.94 },
  { nome: 'Uberlândia', uf: 'MG', lat: -18.91, lon: -48.28 },
  { nome: 'Belém', uf: 'PA', lat: -1.46, lon: -48.5 },
  { nome: 'João Pessoa', uf: 'PB', lat: -7.12, lon: -34.86 },
  { nome: 'Curitiba', uf: 'PR', lat: -25.43, lon: -49.27 },
  { nome: 'Londrina', uf: 'PR', lat: -23.3, lon: -51.16 },
  { nome: 'Recife', uf: 'PE', lat: -8.05, lon: -34.88 },
  { nome: 'Teresina', uf: 'PI', lat: -5.09, lon: -42.8 },
  { nome: 'Rio de Janeiro', uf: 'RJ', lat: -22.91, lon: -43.17 },
  { nome: 'Niterói', uf: 'RJ', lat: -22.88, lon: -43.1 },
  { nome: 'Natal', uf: 'RN', lat: -5.79, lon: -35.21 },
  { nome: 'Porto Velho', uf: 'RO', lat: -8.76, lon: -63.9 },
  { nome: 'Boa Vista', uf: 'RR', lat: 2.82, lon: -60.67 },
  { nome: 'Porto Alegre', uf: 'RS', lat: -30.03, lon: -51.23 },
  { nome: 'Florianópolis', uf: 'SC', lat: -27.59, lon: -48.55 },
  { nome: 'Joinville', uf: 'SC', lat: -26.3, lon: -48.85 },
  { nome: 'São Paulo', uf: 'SP', lat: -23.55, lon: -46.63 },
  { nome: 'Campinas', uf: 'SP', lat: -22.91, lon: -47.06 },
  { nome: 'Ribeirão Preto', uf: 'SP', lat: -21.18, lon: -47.81 },
  { nome: 'Santos', uf: 'SP', lat: -23.96, lon: -46.33 },
  { nome: 'Aracaju', uf: 'SE', lat: -10.91, lon: -37.07 },
  { nome: 'Palmas', uf: 'TO', lat: -10.18, lon: -48.33 },
  { nome: 'Rio Verde', uf: 'GO', lat: -17.79, lon: -50.92 },
];

function normalizar(valor) {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function geocodificar(cidade, uf) {
  const alvo = normalizar(cidade);
  if (!alvo) return null;
  const ufAlvo = uf ? uf.trim().toUpperCase() : undefined;
  const comUf = CIDADES_BRASIL.find((item) => normalizar(item.nome) === alvo && (!ufAlvo || item.uf === ufAlvo));
  return comUf ?? CIDADES_BRASIL.find((item) => normalizar(item.nome) === alvo) ?? null;
}

export function listarCidades(termo) {
  const alvo = termo ? normalizar(termo) : '';
  return CIDADES_BRASIL.filter((item) => !alvo || normalizar(item.nome).includes(alvo) || item.uf.toLowerCase() === alvo);
}
