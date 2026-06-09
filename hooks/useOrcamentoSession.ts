'use client';

/**
 * useOrcamentoSession — sessão simplificada sem IDB.
 *
 * Blobs/Files ficam em imageStore (módulo externo).
 * React gerencia apenas dados JSON-serializáveis pequenos.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { imageStore, type PranchaGroup } from '@/lib/orcamento-construtora/image-store';
import type { FolhaOrcamento, ResultadoOrcamento } from '@/lib/orcamento-construtora/types';
import type { OrquestradorResult, BatchRecord } from '@/app/orcamento-construtora/components/StepIA';

export type Step = 1 | 2 | 3 | 4 | 5;

export interface TokenLog {
  stage: string;
  usage: { input_tokens: number; output_tokens: number };
}

/** Resultado da Leitura Geral (Estágio 1) para uma prancha */
export interface PranchaLeitura {
  stem: string;
  relevante: boolean;
  ambiente: string;
  tipo: string;
  resumo: string;
  itens_vistos: string[];
  cobertura_codigo: 'boa' | 'parcial' | 'minima' | 'nenhuma';
  observacoes?: string;
}

export interface PranchaExtractResult {
  stem: string;
  ok: boolean;
  classificacao: 'DIRETO' | 'IA_AUDITORIA' | 'IA_NECESSARIA' | 'SEM_CONTEUDO';
  precisa_ia: boolean;
  n_itens_extraidos: number;
  itens_extraidos?: Array<{
    descricao?: string;
    quantidade?: number;
    unidade?: string;
    ambiente?: string;
    fonte?: string;
    status?: string;
    categoria?: string;
    pendencias?: string[];
    [key: string]: unknown;
  }>;
  /** Cotas de altura extraídas do texto do PDF: {ceram: 140, pint: 110, forro: 250} */
  height_context?: Record<string, number>;
  fontes: { pdf: boolean; dxf: boolean; image: boolean };
  debug: Record<string, unknown>;
  error?: string;
}

const LS_KEY = 'orc-construtora-v3';

function lsLoad(): {
  step?: number;
  stems?: string[];
  extractResults?: PranchaExtractResult[];
  leituraMap?: PranchaLeitura[];
  orchResult?: OrquestradorResult;
  batchResults?: BatchRecord[];
  folha?: FolhaOrcamento;
  resultado?: ResultadoOrcamento;
  tokenLogs?: TokenLog[];
} | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSave(data: object) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function lsClear() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

export function useOrcamentoSession() {
  const [step,           setStep]           = useState<Step>(1);
  const [stems,          setStems]          = useState<string[]>([]);
  const [extractResults, setExtractResults] = useState<PranchaExtractResult[]>([]);
  const [leituraMap,     setLeituraMap]     = useState<PranchaLeitura[]>([]);
  const [orchResult,     setOrchResult]     = useState<OrquestradorResult | null>(null);
  const [batchResults,   setBatchResults]   = useState<BatchRecord[]>([]);
  const [folha,          setFolha]          = useState<FolhaOrcamento | null>(null);
  const [resultado,      setResultado]      = useState<ResultadoOrcamento | null>(null);
  const [tokenLogs,      setTokenLogs]      = useState<TokenLog[]>([]);
  const [restoredAt,     setRestoredAt]     = useState<number | null>(null);

  // Restore: só localStorage, sem IDB, sem blobs
  useEffect(() => {
    const s = lsLoad();
    if (!s) return;
    if (s.step)           setStep(s.step as Step);
    if (s.stems)          setStems(s.stems);
    if (s.extractResults) setExtractResults(s.extractResults);
    if (s.leituraMap)     setLeituraMap(s.leituraMap);
    if (s.orchResult)     setOrchResult(s.orchResult);
    if (s.batchResults?.length) setBatchResults(s.batchResults);
    if (s.folha)          setFolha(s.folha);
    if (s.resultado)      setResultado(s.resultado);
    if (s.tokenLogs?.length) setTokenLogs(s.tokenLogs);
    if (s.step || s.stems) setRestoredAt(Date.now());
  }, []);

  // Persist — só quando há dados relevantes
  useEffect(() => {
    if (!folha && !resultado && extractResults.length === 0) return;
    lsSave({ step, stems, extractResults, leituraMap, orchResult, batchResults, folha, resultado, tokenLogs });
  }, [step, stems, extractResults, leituraMap, orchResult, folha, resultado, tokenLogs]);

  // Registra grupos no store externo e atualiza stems no state
  const setGroups = useCallback((groups: PranchaGroup[]) => {
    imageStore.set(groups);
    setStems(groups.map((g) => g.stem));
  }, []);

  const accessible = useMemo(() => {
    const s = new Set<Step>([1]);
    if (stems.length > 0)        s.add(2);
    if (extractResults.length > 0) s.add(3);
    if (folha)                   s.add(4);
    if (resultado)               s.add(5);
    return s;
  }, [stems.length, extractResults.length, folha, resultado]);

  const handleUpdate = useCallback(
    (patch: Partial<{ folha: FolhaOrcamento; resultado: ResultadoOrcamento; tokenLog: TokenLog }>) => {
      if (patch.folha)     setFolha(patch.folha);
      if (patch.resultado) setResultado(patch.resultado);
      if (patch.tokenLog) {
        setTokenLogs((prev) => {
          const idx = prev.findIndex((l) => l.stage === patch.tokenLog!.stage);
          return idx >= 0
            ? prev.map((l, i) => (i === idx ? patch.tokenLog! : l))
            : [...prev, patch.tokenLog!];
        });
      }
    },
    [],
  );

  const reset = useCallback(() => {
    lsClear();
    imageStore.clear();
    setStep(1);
    setStems([]);
    setExtractResults([]);
    setLeituraMap([]);
    setOrchResult(null);
    setBatchResults([]);
    setFolha(null);
    setResultado(null);
    setTokenLogs([]);
    setRestoredAt(null);
  }, []);

  const exportSession = useCallback(() => {
    const payload = {
      version: 4,
      exportedAt: new Date().toISOString(),
      stems, extractResults, leituraMap, orchResult, batchResults, folha, resultado, tokenLogs, step,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `orcamento-${(stems[0] ?? 'projeto')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stems, extractResults, orchResult, folha, resultado, step, tokenLogs]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.stems)          setStems(data.stems);
        if (data.extractResults) setExtractResults(data.extractResults);
        if (data.leituraMap)     setLeituraMap(data.leituraMap);
        if (data.orchResult)     setOrchResult(data.orchResult);
        if (data.batchResults?.length) setBatchResults(data.batchResults);
        if (data.folha)          setFolha(data.folha);
        if (data.resultado)      setResultado(data.resultado);
        if (data.tokenLogs)      setTokenLogs(data.tokenLogs);
        if (data.step)           setStep(data.step as Step);
        else if (data.resultado) setStep(5);
        else if (data.folha)     setStep(4);
        setRestoredAt(Date.now());
      } catch { alert('Arquivo de sessão inválido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  return {
    step, setStep,
    stems, setGroups,
    extractResults, setExtractResults,
    leituraMap, setLeituraMap,
    orchResult, setOrchResult,
    batchResults, setBatchResults,
    folha, setFolha,
    resultado, setResultado,
    tokenLogs, setTokenLogs,
    restoredAt,
    accessible,
    handleUpdate,
    reset,
    exportSession,
    handleImport,
  };
}
