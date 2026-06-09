'use client';

import { useEffect, useState } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NoiseEntry { line: string; motivo: string }

interface ItemExtraido {
  id?: number;
  descricao?: string;
  quantidade?: number;
  unidade?: string;
  categoria?: string;
  status?: string;
  fonte?: string;
  confianca?: number;
}

export interface ExtractionDebug {
  // Status
  pdf_ok?: boolean;
  dxf_ok?: boolean;
  classificacao?: string;
  score?: number;
  score_threshold_direto?: number;
  score_threshold_ia_auditoria?: number;

  // Resumos
  pdf_n_raw_lines?: number;
  pdf_n_clean_lines?: number;
  pdf_n_noise_removed?: number;
  pdf_n_tables_cea_qnt?: number;
  pdf_n_measure_lines?: number;
  pdf_n_area_tags?: number;
  dxf_n_layers?: number;
  dxf_n_dims?: number;
  dxf_n_blocks?: number;
  dxf_n_texts?: number;
  n_itens_confirmados?: number;
  n_itens_aguardando?: number;
  height_context?: Record<string, number>;

  // Dados completos
  pdf_raw_lines?: string[];
  pdf_clean_lines?: string[];
  pdf_noise_removed?: NoiseEntry[];
  pdf_measure_lines?: string[];
  pdf_area_tags?: string[];
  pdf_items_confirmados?: ItemExtraido[];
  pdf_items_parciais?: ItemExtraido[];
  dxf_all_layers?: string[];
  dxf_all_dims?: number[];
  dxf_all_blocks?: Record<string, number>;
  dxf_all_texts?: string[];

  // Erros
  erros_pdf?: string[];
  erros_dxf?: string[];
  erros_processamento?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ label, value, color = 'gray' }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-600',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[color] ?? colors.gray}`}>
      <span className="opacity-60">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-100 flex-shrink-0"
    >
      {copied ? '✓' : 'Copiar'}
    </button>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-xs text-gray-400 italic p-3">{msg}</p>;
}

// ─── Seções ───────────────────────────────────────────────────────────────────

function SectionLines({ lines, label }: { lines?: string[]; label: string }) {
  if (!lines?.length) return <EmptyState msg="Nenhuma linha" />;
  const text = lines.join('\n');
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{lines.length} linhas</span>
        <CopyButton text={text} />
      </div>
      <pre className="text-xs font-mono bg-gray-50 rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed text-gray-800">
        {text}
      </pre>
    </div>
  );
}

function SectionNoise({ entries }: { entries?: NoiseEntry[] }) {
  if (!entries?.length) return <EmptyState msg="Nenhuma linha removida" />;
  const byMotivo = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.motivo] = (acc[e.motivo] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Resumo por motivo */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(byMotivo).sort((a, b) => b[1] - a[1]).map(([motivo, cnt]) => (
          <span key={motivo} className="text-xs px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 rounded">
            {motivo}: {cnt}
          </span>
        ))}
      </div>
      {/* Linhas com motivo */}
      <div className="flex flex-col gap-1 overflow-auto max-h-[55vh]">
        {entries.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded px-2 py-1.5">
            <span className="flex-shrink-0 text-orange-500 font-mono font-bold w-28 truncate">{e.motivo}</span>
            <span className="text-gray-600 min-w-0 break-all">{e.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionItems({ items, label }: { items?: ItemExtraido[]; label: string }) {
  if (!items?.length) return <EmptyState msg="Nenhum item" />;
  return (
    <div className="flex flex-col gap-1.5 p-3 overflow-auto max-h-[60vh]">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded-lg px-3 py-2">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${
            it.status === 'confirmado' ? 'bg-green-400' : it.status === 'parcial' ? 'bg-yellow-400' : 'bg-gray-300'
          }`} />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-800">{it.descricao ?? '—'}</span>
            <span className="text-gray-400 ml-1">
              {it.quantidade != null ? `${it.quantidade} ${it.unidade ?? ''}` : '? qty'}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {it.categoria && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded">{it.categoria}</span>}
            {it.fonte && (
              <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${
                it.fonte === 'PDF' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>{it.fonte}</span>
            )}
            {it.confianca != null && <span className="text-gray-300">{it.confianca}%</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionDxfLayers({ layers }: { layers?: string[] }) {
  if (!layers?.length) return <EmptyState msg="Nenhuma layer" />;
  // Agrupa por prefixo (A-FLOR, A-WALL, M-PLMB, etc.)
  const grouped: Record<string, string[]> = {};
  for (const l of layers) {
    const prefix = l.split('-')[0] ?? 'Outros';
    (grouped[prefix] ??= []).push(l);
  }
  return (
    <div className="flex flex-col gap-2 p-3 overflow-auto max-h-[60vh]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{layers.length} layers</span>
        <CopyButton text={layers.join('\n')} />
      </div>
      {Object.entries(grouped).sort().map(([prefix, ls]) => (
        <div key={prefix}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{prefix} ({ls.length})</p>
          <div className="flex flex-wrap gap-1">
            {ls.map((l, i) => (
              <span key={i} className="text-xs px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded font-mono">{l}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionDxfBlocks({ blocks }: { blocks?: Record<string, number> }) {
  if (!blocks || !Object.keys(blocks).length) return <EmptyState msg="Nenhum bloco" />;
  const entries = Object.entries(blocks).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-1 p-3 overflow-auto max-h-[60vh]">
      <span className="text-xs text-gray-400 mb-1">{entries.length} blocos</span>
      {entries.map(([name, cnt], i) => (
        <div key={i} className="flex items-center gap-2 text-xs bg-white border border-gray-100 rounded px-2 py-1.5">
          <span className="flex-1 font-mono text-gray-700 truncate">{name}</span>
          <span className="flex-shrink-0 font-bold text-blue-600">{cnt}×</span>
        </div>
      ))}
    </div>
  );
}

function SectionDxfDims({ dims }: { dims?: number[] }) {
  if (!dims?.length) return <EmptyState msg="Nenhuma cota" />;
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{dims.length} cotas únicas (metros)</span>
        <CopyButton text={dims.join(', ')} />
      </div>
      <div className="flex flex-wrap gap-1 overflow-auto max-h-[55vh]">
        {dims.map((d, i) => (
          <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-50 border border-gray-200 text-gray-700 rounded font-mono">{d}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Definição das seções ─────────────────────────────────────────────────────

type Section = {
  id: string;
  label: string;
  group: 'PDF' | 'DXF' | 'Itens';
  count: (d: ExtractionDebug) => number;
  render: (d: ExtractionDebug) => React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: 'pdf_raw', label: 'PDF Bruto', group: 'PDF',
    count: (d) => d.pdf_n_raw_lines ?? 0,
    render: (d) => <SectionLines lines={d.pdf_raw_lines} label="PDF Bruto" />,
  },
  {
    id: 'pdf_clean', label: 'PDF Limpo', group: 'PDF',
    count: (d) => d.pdf_n_clean_lines ?? 0,
    render: (d) => <SectionLines lines={d.pdf_clean_lines} label="PDF Limpo" />,
  },
  {
    id: 'pdf_noise', label: 'Ruído Removido', group: 'PDF',
    count: (d) => d.pdf_n_noise_removed ?? 0,
    render: (d) => <SectionNoise entries={d.pdf_noise_removed} />,
  },
  {
    id: 'pdf_measures', label: 'Linhas c/ Medidas', group: 'PDF',
    count: (d) => d.pdf_n_measure_lines ?? 0,
    render: (d) => <SectionLines lines={d.pdf_measure_lines} label="Medidas" />,
  },
  {
    id: 'pdf_areas', label: 'Tags de Área', group: 'PDF',
    count: (d) => d.pdf_n_area_tags ?? 0,
    render: (d) => <SectionLines lines={d.pdf_area_tags} label="Áreas" />,
  },
  {
    id: 'itens_confirmados', label: 'Itens Confirmados', group: 'Itens',
    count: (d) => d.n_itens_confirmados ?? 0,
    render: (d) => <SectionItems items={d.pdf_items_confirmados} label="Confirmados" />,
  },
  {
    id: 'itens_parciais', label: 'Itens Aguardando', group: 'Itens',
    count: (d) => d.n_itens_aguardando ?? 0,
    render: (d) => <SectionItems items={d.pdf_items_parciais} label="Aguardando" />,
  },
  {
    id: 'dxf_layers', label: 'DXF Layers', group: 'DXF',
    count: (d) => d.dxf_n_layers ?? 0,
    render: (d) => <SectionDxfLayers layers={d.dxf_all_layers} />,
  },
  {
    id: 'dxf_dims', label: 'DXF Cotas', group: 'DXF',
    count: (d) => d.dxf_n_dims ?? 0,
    render: (d) => <SectionDxfDims dims={d.dxf_all_dims} />,
  },
  {
    id: 'dxf_blocks', label: 'DXF Blocos', group: 'DXF',
    count: (d) => d.dxf_n_blocks ?? 0,
    render: (d) => <SectionDxfBlocks blocks={d.dxf_all_blocks} />,
  },
  {
    id: 'dxf_texts', label: 'DXF Textos', group: 'DXF',
    count: (d) => d.dxf_n_texts ?? 0,
    render: (d) => <SectionLines lines={d.dxf_all_texts} label="Textos" />,
  },
];

const GROUP_COLORS: Record<string, string> = {
  PDF:   'text-blue-600',
  DXF:   'text-purple-600',
  Itens: 'text-green-600',
};

// ─── Modal principal ──────────────────────────────────────────────────────────

export function ExtractionDebugModal({
  stem,
  debug,
  onClose,
}: {
  stem: string;
  debug: ExtractionDebug;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState('pdf_raw');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const currentSection = SECTIONS.find((s) => s.id === selected)!;

  const scoreColor = (debug.score ?? 0) >= (debug.score_threshold_direto ?? 6)
    ? 'text-green-700' : (debug.score ?? 0) >= (debug.score_threshold_ia_auditoria ?? 3)
    ? 'text-yellow-600' : 'text-red-600';

  const groups = ['PDF', 'Itens', 'DXF'] as const;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ height: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-gray-800 text-sm font-mono">{stem}</span>
            <Badge label="score" value={debug.score ?? 0} color={scoreColor === 'text-green-700' ? 'green' : scoreColor === 'text-yellow-600' ? 'orange' : 'red'} />
            <Badge label="class" value={debug.classificacao ?? '—'} />
            {debug.pdf_ok && <Badge label="PDF" value={`${debug.pdf_n_tables_cea_qnt ?? 0} tab | ${debug.pdf_n_clean_lines ?? 0} linhas`} color="blue" />}
            {debug.dxf_ok && <Badge label="DXF" value={`${debug.dxf_n_layers ?? 0}L | ${debug.dxf_n_dims ?? 0}D | ${debug.dxf_n_blocks ?? 0}B`} color="purple" />}
            {(debug.height_context && Object.keys(debug.height_context).length > 0) && (
              <Badge
                label="H"
                value={Object.entries(debug.height_context).map(([k, v]) => `${k}=${v}cm`).join(' ')}
                color="orange"
              />
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl px-1 flex-shrink-0">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <div className="w-44 border-r bg-gray-50 overflow-y-auto flex-shrink-0 p-2">
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <p className={`text-xs font-bold px-2 mb-1 ${GROUP_COLORS[group]}`}>{group}</p>
                {SECTIONS.filter((s) => s.group === group).map((s) => {
                  const cnt = s.count(debug);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between gap-1 ${
                        selected === s.id
                          ? 'bg-blue-600 text-white'
                          : cnt > 0
                          ? 'text-gray-700 hover:bg-gray-200'
                          : 'text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate">{s.label}</span>
                      {cnt > 0 && (
                        <span className={`flex-shrink-0 text-xs font-bold rounded-full px-1 ${
                          selected === s.id ? 'bg-blue-400 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>{cnt}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── Painel principal ──────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b bg-white flex-shrink-0 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{currentSection?.label}</p>
              <span className="text-xs text-gray-400">{currentSection?.count(debug)} registros</span>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              {currentSection?.render(debug)}
            </div>
          </div>
        </div>

        {/* ── Erros (rodapé) ────────────────────────────────────────────── */}
        {([...(debug.erros_pdf ?? []), ...(debug.erros_dxf ?? []), ...(debug.erros_processamento ?? [])]).length > 0 && (
          <div className="px-4 py-2 border-t bg-red-50 flex-shrink-0">
            {[...(debug.erros_pdf ?? []).map(e => `PDF: ${e}`),
               ...(debug.erros_dxf ?? []).map(e => `DXF: ${e}`),
               ...(debug.erros_processamento ?? []).map(e => `PROC: ${e}`)].map((e, i) => (
              <p key={i} className="text-xs text-red-700 font-mono">{e}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
