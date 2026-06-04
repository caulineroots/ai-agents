import { useState } from 'react';
import { PRICE_INPUT, PRICE_OUTPUT } from '@/lib/orcamento-construtora/ui-constants';
import type { TokenLog } from '@/hooks/useOrcamentoSession';

export function TokenLogPanel({ logs }: { logs: TokenLog[] }) {
  const [open, setOpen] = useState(false);

  const totalInput  = logs.reduce((s, l) => s + l.usage.input_tokens, 0);
  const totalOutput = logs.reduce((s, l) => s + l.usage.output_tokens, 0);
  const totalCost   = totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-medium text-gray-700">
          Uso de tokens — {(totalInput + totalOutput).toLocaleString('pt-BR')} total
        </span>
        <span className="text-xs text-gray-500 flex items-center gap-3">
          <span>≈ ${totalCost.toFixed(4)} USD</span>
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {logs.map((log, idx) => {
            const cost = log.usage.input_tokens * PRICE_INPUT + log.usage.output_tokens * PRICE_OUTPUT;
            return (
              <div key={idx} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{log.stage}</span>
                  <span className="text-xs text-gray-400">${cost.toFixed(4)}</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Input: {log.usage.input_tokens.toLocaleString('pt-BR')} tk</span>
                  <span>Output: {log.usage.output_tokens.toLocaleString('pt-BR')} tk</span>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 bg-gray-50 flex justify-between font-medium text-gray-700">
            <span>Total</span>
            <div className="flex gap-4 text-xs text-gray-600">
              <span>Input: {totalInput.toLocaleString('pt-BR')} tk</span>
              <span>Output: {totalOutput.toLocaleString('pt-BR')} tk</span>
              <span className="font-semibold">${totalCost.toFixed(4)} USD</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
