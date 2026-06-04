import { useEffect } from 'react';
import { useOrcamentoPipeline } from '@/hooks/useOrcamentoPipeline';
import { PRICE_INPUT, PRICE_OUTPUT } from '@/lib/orcamento-construtora/ui-constants';
import type { FolhaOrcamento, ResultadoOrcamento } from '@/lib/orcamento-construtora/types';
import type { TokenLog, Step } from '@/hooks/useOrcamentoSession';

export function StepProcessing({
  imageBlobs,
  imageFilenames,
  resultado,
  tokenLogs,
  onUpdate,
  onNavigate,
}: {
  imageBlobs: Blob[];
  imageFilenames: string[];
  resultado: ResultadoOrcamento | null;
  tokenLogs: TokenLog[];
  onUpdate: (patch: Partial<{ folha: FolhaOrcamento; resultado: ResultadoOrcamento; tokenLog: TokenLog }>) => void;
  onNavigate: (step: Step) => void;
}) {
  const pipeline = useOrcamentoPipeline(imageBlobs, imageFilenames);
  const isDone = pipeline.phase === 'done' || !!resultado;

  useEffect(() => {
    if (pipeline.result) onUpdate(pipeline.result);
  }, [pipeline.result]); // eslint-disable-line react-hooks/exhaustive-deps

  const FONTE_COLOR: Record<string, string> = {
    PDF: 'bg-green-100 text-green-700 border-green-300',
    DXF: 'bg-blue-100 text-blue-700 border-blue-300',
    IA:  'bg-purple-100 text-purple-700 border-purple-300',
  };
  const CLASS_COLOR: Record<string, string> = {
    DIRETO:       'text-green-700 bg-green-50 border-green-200',
    IA_AUDITORIA: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    IA_NECESSARIA:'text-red-700 bg-red-50 border-red-200',
  };
  const CLASS_LABEL: Record<string, string> = {
    DIRETO:       'Extração direta (sem IA necessária)',
    IA_AUDITORIA: 'IA de auditoria (dados parciais)',
    IA_NECESSARIA:'IA essencial (sem dados estruturados)',
  };

  const steps = [
    { id: 'extract', label: pipeline.extractLabel, done: pipeline.extractDone },
    { id: 'ai',      label: pipeline.aiLabel,      done: pipeline.aiDone      },
  ];
  const currentStep = pipeline.extractDone ? 1 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Passo 2 — Análise do Projeto</h2>
        {imageBlobs.length > 0 ? (
          <p className="text-sm text-gray-500 mt-1">
            {imageBlobs.length} {imageBlobs.length === 1 ? 'prancha carregada' : 'pranchas carregadas'} · extração PDF+DXF + {imageBlobs.length} chamada{imageBlobs.length > 1 ? 's' : ''} IA
          </p>
        ) : (
          <p className="text-sm text-amber-600 mt-1">⚠ Imagem não carregada.</p>
        )}
      </div>

      {(pipeline.phase === 'running' || pipeline.phase === 'done') && (
        <div className="flex flex-col gap-2">
          {steps.map((step, idx) => {
            const isActive   = pipeline.phase === 'running' && idx === currentStep;
            const isDoneStep = step.done;
            return (
              <div key={step.id} className={`flex items-center gap-3 rounded-lg px-4 py-3 border transition-all ${
                isDoneStep ? 'bg-green-50 border-green-200' :
                isActive   ? 'bg-blue-50 border-blue-300' :
                             'bg-gray-50 border-gray-200 opacity-40'
              }`}>
                <div className="flex-shrink-0">
                  {isDoneStep
                    ? <span className="text-green-600 text-sm font-bold">✓</span>
                    : isActive
                    ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    : <span className="w-4 h-4 rounded-full border border-gray-300 inline-block" />}
                </div>
                <p className={`text-sm font-medium ${
                  isDoneStep ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-gray-400'
                }`}>{step.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {isDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-green-800">✓ Análise concluída</p>
          <div className="flex gap-2 flex-wrap items-center text-xs">
            {pipeline.fontesUsadas.map((f) => (
              <span key={f} className={`px-2 py-0.5 rounded-full border font-medium ${FONTE_COLOR[f] ?? 'bg-gray-100 text-gray-600'}`}>
                {f}
              </span>
            ))}
            {pipeline.classificacao && (
              <span className={`px-2 py-0.5 rounded-full border font-medium ${CLASS_COLOR[pipeline.classificacao] ?? ''}`}>
                {CLASS_LABEL[pipeline.classificacao] ?? pipeline.classificacao}
              </span>
            )}
            {tokenLogs.map((log) => {
              const cost = log.usage.input_tokens * PRICE_INPUT + log.usage.output_tokens * PRICE_OUTPUT;
              return (
                <span key={log.stage} className="bg-white border border-green-200 rounded px-2 py-0.5 text-gray-500">
                  {(log.usage.input_tokens + log.usage.output_tokens).toLocaleString('pt-BR')} tk · ${cost.toFixed(3)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {pipeline.error && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
          {pipeline.error}
        </pre>
      )}

      <div className="flex flex-wrap gap-3 items-center pt-1">
        <button
          onClick={pipeline.run}
          disabled={pipeline.phase === 'running' || imageBlobs.length === 0}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pipeline.phase === 'running' ? 'Analisando...' : isDone ? 'Re-analisar' : 'Analisar Projeto →'}
        </button>
        {isDone && (
          <button
            onClick={() => onNavigate(3)}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Ver Revisão →
          </button>
        )}
        {resultado && (
          <button
            onClick={() => onNavigate(4)}
            className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 active:scale-95 transition-all"
          >
            Ver Orçamento →
          </button>
        )}
      </div>
    </div>
  );
}
