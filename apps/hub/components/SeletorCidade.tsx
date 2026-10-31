'use client';

import { useEffect, useRef, useState } from 'react';
import type { CidadeGeo } from '@spl/contracts';
import { listarCidadesPorUf } from '@spl/contracts';
import { ESTADOS } from '@/lib/brasil';
import { projetar } from '@/lib/geo';

interface SeletorCidadeProps {
  ufInicial?: string | null;
  onEscolher: (cidade: CidadeGeo) => void;
}

export function SeletorCidade({ ufInicial, onEscolher }: SeletorCidadeProps) {
  const [uf, setUf] = useState<string | null>(ufInicial ?? null);
  const [busca, setBusca] = useState('');
  const [viewBox, setViewBox] = useState('0 0 640 640');
  const svgRef = useRef<SVGSVGElement>(null);
  const cidades = uf ? listarCidadesPorUf(uf) : [];
  const cidadesFiltradas = busca
    ? cidades.filter((cidade) => cidade.nome.toLowerCase().includes(busca.toLowerCase()))
    : cidades;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !uf) { setViewBox('0 0 640 640'); return; }
    const path = svg.querySelector<SVGPathElement>(`path[data-sigla="${uf}"]`);
    if (!path) return;
    const caixa = path.getBBox();
    const pad = Math.max(caixa.width, caixa.height) * 0.25 + 10;
    setViewBox(`${caixa.x - pad} ${caixa.y - pad} ${caixa.width + pad * 2} ${caixa.height + pad * 2}`);
  }, [uf]);

  return (
    <div className="seletor-cidade">
      <svg ref={svgRef} viewBox={viewBox} role="img" aria-label="Selecionar estado e cidade">
        {ESTADOS.map((item) => (
          <path
            key={item.sigla}
            data-sigla={item.sigla}
            className={`estado-sel${item.sigla === uf ? ' ativo' : ''}`}
            d={item.d}
            onClick={() => { setUf(item.sigla); setBusca(''); }}
          />
        ))}
        {uf && cidades.map((cidade) => {
          const ponto = projetar(cidade.lat, cidade.lon);
          return (
            <g key={`${cidade.uf}-${cidade.nome}`} className="cidade-ponto" onClick={() => onEscolher(cidade)}>
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
              <button type="button" className="btn fantasma" onClick={() => { setUf(null); setBusca(''); }}>← Estados</button>
              <span className="aviso">{ESTADOS.find((item) => item.sigla === uf)?.nome}</span>
            </div>
            <input
              className="campo"
              placeholder="Buscar cidade…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="seletor-cidades-lista">
              {cidadesFiltradas.map((cidade) => (
                <button key={`${cidade.uf}-${cidade.nome}`} type="button" className="seletor-cidade-item" onClick={() => onEscolher(cidade)}>
                  {cidade.nome}
                </button>
              ))}
              {cidadesFiltradas.length === 0 && <p className="aviso">Nenhuma cidade encontrada.</p>}
            </div>
          </>
        ) : (
          <p className="aviso">Clique em um estado no mapa pra ver as cidades.</p>
        )}
      </div>
    </div>
  );
}
