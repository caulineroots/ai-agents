'use client';

import { useEffect, useState } from 'react';

export interface AIDebugEntry {
  label: string;
  prompt: string;
  output: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

export function AIDebugModal({
  entries,
  initialIndex,
  onClose,
}: {
  entries: AIDebugEntry[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(initialIndex ?? entries.length - 1);
  const [tab, setTab] = useState<'prompt' | 'output'>('prompt');

  // Fecha com Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Quando entries cresce (nova chamada), seleciona a mais recente
  useEffect(() => {
    setSelected(entries.length - 1);
  }, [entries.length]);

  const current = entries[selected];
  const content = tab === 'prompt' ? current?.prompt : current?.output;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden"
        style={{ height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-gray-800">Debug IA</span>
            <span className="text-xs text-gray-400">{entries.length} chamada{entries.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar: lista de chamadas ───────────────────────────── */}
          <div className="w-52 border-r border-gray-200 overflow-y-auto flex-shrink-0 bg-gray-50 p-2 flex flex-col gap-1">
            {entries.map((e, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  selected === i
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="block font-mono text-xs opacity-60 mb-0.5">#{i + 1}</span>
                {e.label}
              </button>
            ))}
          </div>

          {/* ── Painel principal ─────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-gray-200 flex-shrink-0">
              {(['prompt', 'output'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                    tab === t
                      ? 'bg-white border-gray-200 text-gray-900'
                      : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t === 'prompt' ? '→ Prompt (Input)' : '← Output Bruto'}
                </button>
              ))}
              <div className="ml-auto pb-1">
                {content && <CopyButton text={content} />}
              </div>
            </div>

            {/* Conteúdo */}
            {current ? (
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-gray-800 whitespace-pre-wrap break-all bg-white">
                {content || '(vazio)'}
              </pre>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                Nenhuma chamada disponível
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
