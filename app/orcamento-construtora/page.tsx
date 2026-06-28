'use client';

import Link from 'next/link';
import { Component, type ReactNode, useCallback, useEffect } from 'react';
import { calcularOrcamento }        from '@/lib/orcamento-construtora/calcular';
import { imageStore }               from '@/lib/orcamento-construtora/image-store';
import { saveGroupsToIDB, restoreGroupsFromIDB } from '@/lib/orcamento-construtora/image-db';
import { useOrcamentoSession }      from '@/hooks/useOrcamentoSession';
import { Stepper }              from './components/Stepper';
import { StepUpload }           from './components/StepUpload';
import { StepExtract }          from './components/StepExtract';
import { StepIA }               from './components/StepIA';
import { StepReview }           from './components/StepReview';
import { StepOrcamento }        from './components/StepOrcamento';

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(err: Error, info: { componentStack: string }) {
    console.error('[OrcamentoCrash]', err.message, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
          <div className="bg-zinc-900 rounded-2xl shadow border border-red-900/50 p-8 max-w-xl w-full space-y-4">
            <h2 className="text-lg font-bold text-red-400">Erro ao renderizar</h2>
            <pre className="text-xs text-red-400 bg-red-950/40 rounded p-4 overflow-auto whitespace-pre-wrap">
              {this.state.error.message}{'\n\n'}{this.state.error.stack?.slice(0, 600)}
            </pre>
            <button
              onClick={() => { try { localStorage.clear(); } catch {} window.location.reload(); }}
              className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500"
            >
              Limpar sessão e recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function OrcamentoInner() {
  const {
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
  } = useOrcamentoSession();

  // Sempre que folha mudar (import ou fluxo normal), recalcula com o código atual
  useEffect(() => {
    if (folha) setResultado(calcularOrcamento(folha));
  }, [folha]); // eslint-disable-line react-hooks/exhaustive-deps

  // Após import de sessão: restaura imagens do IndexedDB pelo stem
  const handleImportWithRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleImport(e);
    // Aguarda o estado atualizar (stems vem do extractResults após o import)
    setTimeout(async () => {
      const currentStems = imageStore.stems();
      if (currentStems.length > 0) return; // imagens já estão na memória

      // Pega stems dos extractResults (já atualizados pelo handleImport via localStorage)
      const stored = (() => {
        try { return JSON.parse(localStorage.getItem('orcamento-session') ?? '{}'); } catch { return {}; }
      })();
      const importedStems: string[] = (stored.extractResults ?? []).map((r: { stem: string }) => r.stem);
      if (importedStems.length === 0) return;

      const restored = await restoreGroupsFromIDB(importedStems);
      if (restored.length > 0) {
        imageStore.set(restored);
        console.log(`[IDB] ${restored.length} grupos restaurados do IndexedDB`);
      } else {
        console.warn('[IDB] Nenhuma imagem encontrada no IndexedDB — arquivos precisam ser re-selecionados para análise IA');
      }
    }, 300);
  }, [handleImport]);

  return (
    <div className="h-screen overflow-y-auto bg-zinc-950 py-12 px-4">
      <div className={`mx-auto transition-all ${step === 4 ? 'w-full px-4' : 'max-w-3xl'}`}>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Orçamento Construtora</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Análise automática por IA do projeto executivo de fit-out
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Link
              href="/orcamento-construtora/aprender"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium bg-zinc-800 text-purple-400 border-zinc-700 hover:bg-zinc-700 transition-colors"
            >
              Banco de Nomes
            </Link>
            <label className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium cursor-pointer bg-zinc-800 text-blue-400 border-zinc-700 hover:bg-zinc-700 transition-colors">
              Importar
              <input type="file" accept=".json" className="hidden" onChange={handleImportWithRestore} />
            </label>
            {(folha || resultado || extractResults.length > 0) && (
              <button onClick={exportSession} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium bg-green-600 text-white border-green-500 hover:bg-green-500 transition-colors">
                Salvar sessão
              </button>
            )}
            <button onClick={reset} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 transition-colors">
              Limpar
            </button>
          </div>
        </div>

        {restoredAt && (
          <div className="mb-4 flex items-center justify-between gap-3 text-xs bg-indigo-950/50 border border-indigo-800/60 rounded-lg px-4 py-2.5">
            <span className="text-indigo-300">
              Sessão restaurada — {new Date(restoredAt).toLocaleString('pt-BR')}
            </span>
            <button onClick={reset} className="text-indigo-400 hover:text-indigo-200 underline">Limpar</button>
          </div>
        )}

        <Stepper current={step} accessible={accessible} onNavigate={setStep} />

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-8">

          {/* Step 1: Upload */}
          {step === 1 && (
            <StepUpload
              existingStems={stems}
              onDone={(groups) => {
                setGroups(groups);
                // Persiste imagens no IndexedDB para uso após import de sessão
                saveGroupsToIDB(groups).catch((err) =>
                  console.warn('[IDB] Falha ao salvar imagens:', err)
                );
                setStep(2);
              }}
            />
          )}

          {/* Step 2: Extração por código */}
          {step === 2 && (
            <StepExtract
              groups={imageStore.get()}
              existingResults={extractResults}
              onExtractDone={(results) => {
                setExtractResults(results);
              }}
              onRunAI={() => setStep(3)}
              onNavigate={setStep}
              onExportSession={exportSession}
            />
          )}

          {/* Step 3: IA — Leitura Geral + Orquestrador + Batches de Detalhe */}
          {step === 3 && (
            <StepIA
              groups={imageStore.get()}
              extractResults={extractResults}
              existingLeituraMap={leituraMap}
              existingOrchResult={orchResult}
              existingBatchResults={batchResults}
              existingFinalFolha={folha}
              onBatchResultsChange={setBatchResults}
              onDone={(folha, orch, leitura, logs) => {
                setLeituraMap(leitura);
                setOrchResult(orch);
                setBatchResults([]);
                setFolha(folha);
                setTokenLogs((prev) => [...prev, ...logs]);
                setStep(4);
              }}
            />
          )}

          {/* Step 4: Revisão */}
          {step === 4 && folha && (
            <StepReview
              folha={folha}
              groups={imageStore.get().filter((g) => g.imageFile || g.pdfFile)}
              onDone={(updated) => {
                setFolha(updated);
                setResultado(calcularOrcamento(updated));
                setStep(5);
              }}
            />
          )}

          {/* Step 5: Orçamento */}
          {step === 5 && folha && resultado && (
            <StepOrcamento
              folha={folha}
              resultado={resultado}
              tokenLogs={tokenLogs}
              onReset={reset}
              onFolhaChange={setFolha}
            />
          )}

        </div>
      </div>
    </div>
  );
}

export default function OrcamentoConstutoraPage() {
  return (
    <ErrorBoundary>
      <OrcamentoInner />
    </ErrorBoundary>
  );
}
