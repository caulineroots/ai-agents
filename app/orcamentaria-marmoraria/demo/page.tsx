'use client';

import { useState, useRef } from 'react';
import { StepReview } from '@/app/orcamento/components/StepReview';
import { StepOrcamento } from '@/app/orcamento/components/StepOrcamento';
import { DEMO_FOLHA, DEMO_RESULTADO, DEMO_TOKEN_LOGS } from '@/lib/orcamento/demo-data';
import type { FolhaMedicao, ResultadoOrcamento } from '@/lib/orcamento/types';
import { calcularOrcamento } from '@/lib/orcamento/calcular';

const WHATSAPP_NUMBER = '5511914991065';
const WHATSAPP_MESSAGE = 'Olá Roberto, gostaria de saber mais da OrçamentarIA';

const DEMO_IMAGE_URLS = Array.from({ length: 13 }, (_, i) =>
  `/demo-images/prancha-${String(i + 1).padStart(2, '0')}.webp`
);

const DEMO_HINTS: Record<number, string> = {
  1: 'Aqui a IA errou — o serviço "Furo cuba embutir" deveria estar listado, mas não foi identificado na prancha.',
  5: 'Aqui a IA errou — a borda deveria ser ~4.6 ml (soma dos lados do tampo), não 1.8 ml. O serviço "Furo para torre de tomada" também ficou de fora.',
};

export default function DemoPage() {
  const [step, setStep] = useState<3 | 4>(3);
  const [folha, setFolha] = useState<FolhaMedicao>(DEMO_FOLHA);
  const [resultado, setResultado] = useState<ResultadoOrcamento>(DEMO_RESULTADO);
  const flushRef = useRef<() => void>(() => {});
  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDoneReview = (updatedFolha: FolhaMedicao) => {
    setFolha(updatedFolha);
    const newResultado = calcularOrcamento(updatedFolha);
    setResultado(newResultado);
    setStep(4);
    setTimeout(scrollToTop, 50);
  };

  const handleGoToReview = () => {
    setStep(3);
    setTimeout(() => {
      const firstPendencia = folha.itens.find((i) => (i.pendencias ?? []).length > 0);
      if (firstPendencia) {
        const el = document.getElementById(`item-${firstPendencia.id}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleReset = () => {
    setFolha(DEMO_FOLHA);
    setResultado(DEMO_RESULTADO);
    setStep(3);
  };

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <div ref={topRef} />
      {/* Demo header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-zinc-100 tracking-tight">OrçamentarIA</span>
            <span className="px-2 py-0.5 text-xs font-bold tracking-widest uppercase rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">
              DEMO
            </span>
          </div>
          <div className="flex items-center gap-3">
            {step === 4 && (
              <button
                onClick={() => setStep(3)}
                className="text-sm px-3 py-1.5 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-all"
              >
                ← Revisão
              </button>
            )}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-1.5 bg-violet-500 text-white rounded font-medium hover:bg-violet-400 transition-colors"
            >
              Quero usar de verdade →
            </a>
          </div>
        </div>

        {/* Step indicator */}
        <div className="border-t border-zinc-800/50 bg-zinc-950/60">
          <div className="max-w-7xl mx-auto px-6 h-9 flex items-center gap-6">
            <button
              onClick={() => setStep(3)}
              className={`text-sm font-medium transition-colors ${step === 3 ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Revisão
            </button>
            <div className="h-px w-8 bg-zinc-800" />
            <button
              onClick={() => { if (step === 4) return; flushRef.current(); }}
              className={`text-sm font-medium transition-colors ${step === 4 ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Orçamento
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-6">
        {step === 3 && (
          <StepReview
            folha={folha}
            imageBlobs={[]}
            imageUrls={DEMO_IMAGE_URLS}
            flushRef={flushRef}
            onDone={handleDoneReview}
            demoHints={DEMO_HINTS}
          />
        )}
        {step === 4 && (
          <StepOrcamento
            folha={folha}
            resultado={resultado}
            tokenLogs={DEMO_TOKEN_LOGS}
            onRestart={handleReset}
            onGoToReview={handleGoToReview}
            showTokens={false}
            hideActions
          />
        )}
      </main>

      {/* Bottom CTA */}
      <div className="border-t border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-zinc-100">Gostou do que viu?</p>
            <p className="text-sm text-zinc-400 mt-0.5">Na versão real, você sobe o PDF do seu projeto e a IA gera tudo isso em minutos.</p>
          </div>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 px-6 py-3 bg-violet-500 text-white rounded font-semibold text-base hover:bg-violet-400 active:scale-95 transition-all"
          >
            Falar no WhatsApp →
          </a>
        </div>
      </div>
    </div>
  );
}
