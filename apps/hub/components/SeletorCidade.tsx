'use client';

import { useEffect, useRef, useState } from 'react';
import type { CidadeGeo } from '@spl/contracts';
import { listarCidades, listarCidadesPorUf } from '@spl/contracts';
import { ESTADOS } from '@/lib/brasil';
import { buscarEnderecoPorCep, formatarCep, soDigitosDoCep, type EnderecoCep } from '@/lib/cep';
import { mensagemDeErro } from '@/lib/dados';
import { projetar } from '@/lib/ponto';

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
      const achado = await buscarEnderecoPorCep(digitos);
      if (pedidoCep.current === pedido) setEndereco(achado);
    } catch (falha) {
      if (pedidoCep.current === pedido) setErroCep(mensagemDeErro(falha, 'Não deu para consultar o CEP.'));
    } finally {
      if (pedidoCep.current === pedido) setConsultando(false);
    }
  }

  function trocarCep(valor: string) {
    const digitos = soDigitosDoCep(valor);
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
