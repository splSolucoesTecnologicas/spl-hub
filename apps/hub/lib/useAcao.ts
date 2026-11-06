'use client';

import { useCallback, useState } from 'react';
import { mensagemDeErro } from './dados';

export interface Acao {
  erro: string;
  executando: boolean;
  /** Roda a ação e devolve se deu certo; a falha vira a mensagem em `erro`. */
  executar: (acao: () => Promise<unknown>, padrao?: string) => Promise<boolean>;
  limparErro: () => void;
}

export function useAcao(): Acao {
  const [erro, setErro] = useState('');
  const [executando, setExecutando] = useState(false);

  const executar = useCallback(async (acao: () => Promise<unknown>, padrao = 'Não foi possível concluir') => {
    setErro('');
    setExecutando(true);
    try {
      await acao();
      return true;
    } catch (falha) {
      setErro(mensagemDeErro(falha, padrao));
      return false;
    } finally {
      setExecutando(false);
    }
  }, []);

  const limparErro = useCallback(() => setErro(''), []);

  return { erro, executando, executar, limparErro };
}
