import { useState } from 'react';
import { PRICE_INPUT, PRICE_OUTPUT } from '@/lib/orcamento-construtora/ui-constants';
import type { TokenLog } from '@/hooks/useOrcamentoSession';

export function TokenLogPanel({ logs }: { logs: TokenLog[] }) {
  const [open, setOpen] = useState(false);

  const totalInput  = logs.reduce((s, l) => s + l.usage.input_tokens, 0);
  const totalOutput = logs.reduce((s, l) => s + l.usage.output_tokens, 0);
  const totalCost   = totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors text-left"
      >
        <span className="font-medium text-zinc-200">
          Uso de tokens — {(totalInput + totalOutput).toLocaleString('pt-BR')} total
        </span>
        <span className="text-xs text-zinc-400 flex items-center gap-3">
          <span>≈ ${totalCost.toFixed(4)} USD</span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="divide-y divide-zinc-700/60">
          {logs.map((log, idx) => {
            const cost = log.usage.input_tokens * PRICE_INPUT + log.usage.output_tokens * PRICE_OUTPUT;
            return (
              <div key={idx} className="px-4 py-3 flex flex-col gap-1 bg-zinc-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-300">{log.stage}</span>
                  <span className="text-xs text-zinc-300 font-semibold">${cost.toFixed(4)}</span>
                </div>
                <div className="flex gap-4 text-xs text-zinc-500">
                  <span>Input: {log.usage.input_tokens.toLocaleString('pt-BR')} tk</span>
                  <span>Output: {log.usage.output_tokens.toLocaleString('pt-BR')} tk</span>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 bg-zinc-800/60 flex justify-between font-medium text-zinc-200">
            <span>Total</span>
            <div className="flex gap-4 text-xs text-zinc-300">
              <span>Input: {totalInput.toLocaleString('pt-BR')} tk</span>
              <span>Output: {totalOutput.toLocaleString('pt-BR')} tk</span>
              <span className="font-semibold text-white">${totalCost.toFixed(4)} USD</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
