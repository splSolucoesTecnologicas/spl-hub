'use client';

import { useEffect, useRef, useState } from 'react';
import type { CidadeGeo } from '@spl/contracts';
import { geocodificar, listarCidades, listarCidadesPorUf } from '@spl/contracts';
import { ESTADOS } from '@/lib/brasil';
import { projetar } from '@/lib/geo';

/** Resposta da BrasilAPI v2. `location` pode vir vazio e o corpo pode ser um erro. */
type RespostaCep = {
  cep?: string; state?: string; city?: string; neighborhood?: string | null; street?: string | null;
  location?: { coordinates?: { latitude?: string; longitude?: string } };
  name?: string; message?: string;
};

type EnderecoCep = { cidade: CidadeGeo; rua: string | null; bairro: string | null; municipioInteiro: boolean };

function soDigitos(valor: string) { return valor.replace(/\D/g, '').slice(0, 8); }

function formatarCep(digitos: string) {
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

async function consultarCep(digitos: string): Promise<EnderecoCep> {
  const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`);
  const corpo = (await resposta.json()) as RespostaCep;
  if (!resposta.ok || corpo.name || !corpo.city || !corpo.state) throw new Error('CEP nao encontrado.');
  const bruto = corpo.location?.coordinates;
  const lat = bruto?.latitude != null ? Number(bruto.latitude) : NaN;
  const lon = bruto?.longitude != null ? Number(bruto.longitude) : NaN;
  // Sem coordenada na base do CEP, o centro da cidade ainda e melhor que nada.
  const reserva = Number.isFinite(lat) && Number.isFinite(lon) ? null : geocodificar(corpo.city, corpo.state);
  if (!reserva && !Number.isFinite(lat)) throw new Error('CEP sem coordenada conhecida. Use a busca por cidade.');
  return {
    cidade: { nome: corpo.city, uf: corpo.state, lat: reserva ? reserva.lat : lat, lon: reserva ? reserva.lon : lon },
    rua: corpo.street ?? null,
    bairro: corpo.neighborhood ?? null,
    municipioInteiro: !corpo.street,
  };
}

interface SeletorCidadeProps {
  ufInicial?: string | null;
  onEscolher: (cidade: CidadeGeo) => void;
}

export function SeletorCidade({ ufInicial, onEscolher }: SeletorCidadeProps) {
  const [uf, setUf] = useState<string | null>(ufInicial ?? null);
  const [busca, setBusca] = useState('');
  const [cep, setCep] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [erroCep, setErroCep] = useState('');
  const [endereco, setEndereco] = useState<EnderecoCep | null>(null);
  const pedidoCep = useRef(0);
  const [viewBox, setViewBox] = useState('0 0 640 640');
  const svgRef = useRef<SVGSVGElement>(null);
  const termo = busca.trim();
  const resultadosBusca = termo.length >= 2 ? listarCidades(termo).slice(0, 40) : [];
  const buscando = termo.length >= 2;
  const cidadesDoEstado = uf ? listarCidadesPorUf(uf) : [];

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !uf) { setViewBox('0 0 640 640'); return; }
    const path = svg.querySelector<SVGPathElement>(`path[data-sigla="${uf}"]`);
    if (!path) return;
    const caixa = path.getBBox();
    const pad = Math.max(caixa.width, caixa.height) * 0.25 + 10;
    setViewBox(`${caixa.x - pad} ${caixa.y - pad} ${caixa.width + pad * 2} ${caixa.height + pad * 2}`);
  }, [uf]);

  function escolher(cidade: CidadeGeo) {
    onEscolher(cidade);
    setBusca('');
  }

  async function buscarCep(digitos: string) {
    const pedido = ++pedidoCep.current;
    setConsultando(true);
    setErroCep('');
    setEndereco(null);
    try {
      const achado = await consultarCep(digitos);
      if (pedidoCep.current === pedido) setEndereco(achado);
    } catch (falha) {
      if (pedidoCep.current === pedido) setErroCep(falha instanceof Error ? falha.message : 'Nao deu pra consultar o CEP.');
    } finally {
      if (pedidoCep.current === pedido) setConsultando(false);
    }
  }

  function trocarCep(valor: string) {
    const digitos = soDigitos(valor);
    setCep(digitos);
    setErroCep('');
    setEndereco(null);
    pedidoCep.current += 1;
    if (digitos.length === 8) void buscarCep(digitos);
  }

  return (
    <div className="seletor-cidade-wrap">
      <div className="cep-busca">
        <input
          className="campo"
          inputMode="numeric"
          placeholder="CEP (00000-000)"
          value={formatarCep(cep)}
          onChange={(e) => trocarCep(e.target.value)}
        />
        {consultando && <p className="aviso">Consultando CEP…</p>}
        {erroCep && <p className="erro">{erroCep}</p>}
        {endereco && (
          <div className="cep-achado">
            <p>
              <b>{endereco.rua ?? endereco.cidade.nome}</b>
              {endereco.bairro && <> · {endereco.bairro}</>}
              <br />
              <span className="aviso">{endereco.cidade.nome} · {endereco.cidade.uf}</span>
            </p>
            {endereco.municipioInteiro && (
              <p className="aviso">Esse CEP cobre o município inteiro — o ponto cai no centro da cidade.</p>
            )}
            <button type="button" className="btn" onClick={() => { escolher(endereco.cidade); setCep(''); setEndereco(null); }}>
              Usar este endereço
            </button>
          </div>
        )}
      </div>
      <p className="aviso">Ou escolha pela cidade:</p>
      <input
        className="campo"
        placeholder="Digite o nome da cidade…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {buscando ? (
        <div className="seletor-cidades-lista seletor-busca-resultados">
          {resultadosBusca.map((cidade) => (
            <button key={`${cidade.uf}-${cidade.nome}`} type="button" className="seletor-cidade-item" onClick={() => escolher(cidade)}>
              {cidade.nome} <span className="aviso">· {cidade.uf}</span>
            </button>
          ))}
          {resultadosBusca.length === 0 && <p className="aviso">Nenhuma cidade encontrada.</p>}
        </div>
      ) : (
        <div className="seletor-cidade">
          <svg ref={svgRef} viewBox={viewBox} role="img" aria-label="Selecionar estado e cidade">
            {ESTADOS.map((item) => (
              <path
                key={item.sigla}
                data-sigla={item.sigla}
                className={`estado-sel${item.sigla === uf ? ' ativo' : ''}`}
                d={item.d}
                onClick={() => setUf(item.sigla)}
              />
            ))}
            {uf && cidadesDoEstado.map((cidade) => {
              const ponto = projetar(cidade.lat, cidade.lon);
              return (
                <g key={`${cidade.uf}-${cidade.nome}`} className="cidade-ponto" onClick={() => escolher(cidade)}>
                  <circle cx={ponto.x} cy={ponto.y} r="2.6" />
                  <title>{cidade.nome}</title>
                </g>
              );
            })}
          </svg>
          <div className="seletor-lado">
            {uf ? (
              <>
                <div className="linha">
                  <button type="button" className="btn fantasma" onClick={() => setUf(null)}>← Estados</button>
                  <span className="aviso">{ESTADOS.find((item) => item.sigla === uf)?.nome}</span>
                </div>
                <div className="seletor-cidades-lista">
                  {cidadesDoEstado.map((cidade) => (
                    <button key={`${cidade.uf}-${cidade.nome}`} type="button" className="seletor-cidade-item" onClick={() => escolher(cidade)}>
                      {cidade.nome}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="aviso">Ou clique em um estado no mapa pra ver as cidades.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
