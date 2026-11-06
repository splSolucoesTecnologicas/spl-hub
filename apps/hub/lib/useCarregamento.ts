'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { mensagemDeErro } from './dados';

export interface Carregamento<T> {
  dados: T | undefined;
  erro: string;
  carregando: boolean;
  recarregar: () => Promise<void>;
  /** Ajuste local, como a atualização otimista de um card; o próximo recarregar sobrescreve. */
  definir: (atualizar: (atual: T | undefined) => T | undefined) => void;
}

interface EstadoDoCarregamento<T> {
  dados: T | undefined;
  erro: string;
  carregando: boolean;
}

/** Carrega ao montar e quando as dependências mudam. Resposta que chega atrasada, de uma carga anterior, é descartada. */
export function useCarregamento<T>(carregar: () => Promise<T>, deps: DependencyList): Carregamento<T> {
  const [estado, setEstado] = useState<EstadoDoCarregamento<T>>({ dados: undefined, erro: '', carregando: true });
  const versao = useRef(0);
  const carregarAtual = useRef(carregar);
  carregarAtual.current = carregar;

  const recarregar = useCallback(async () => {
    const minha = ++versao.current;
    setEstado((atual) => ({ ...atual, carregando: true, erro: '' }));
    try {
      const dados = await carregarAtual.current();
      if (minha === versao.current) setEstado({ dados, erro: '', carregando: false });
    } catch (falha) {
      if (minha === versao.current) setEstado((atual) => ({ ...atual, erro: mensagemDeErro(falha, 'Não foi possível carregar'), carregando: false }));
    }
  }, []);

  useEffect(() => {
    void recarregar();
    return () => { versao.current++; };
  }, deps);

  const definir = useCallback((atualizar: (atual: T | undefined) => T | undefined) => {
    setEstado((atual) => ({ ...atual, dados: atualizar(atual.dados) }));
  }, []);

  return { ...estado, recarregar, definir };
}
