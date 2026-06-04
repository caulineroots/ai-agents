'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchedItem {
  item_name: string;
  matched_to: string;
  id: string;
}

interface AnaliseResult {
  matched: MatchedItem[];
  unmatched: string[];
  coverage_pct: number;
  total_items: number;
}

interface Suggestion {
  item_name: string;
  tipo: 'variacao' | 'novo' | 'ruido';
  target_id: string | null;
  canonical_name: string | null;
  category: string | null;
  unit: string | null;
  has_price: boolean;
  rationale: string;
  confidence: number;       // 0-100
  is_orcavel: boolean;      // false = ruído/instrução
}

interface FileScan {
  filename: string;
  ext: string;
  needs_ai: boolean;
  reason: string;
  items_found: number;
  tables_found: number;
  measures_found: number;
  size_kb: number;
}

type Step = 'upload' | 'analisando' | 'analise' | 'sugerindo' | 'sugestoes' | 'atualizando' | 'verificando' | 'verificado';

const API = '/api/orcamento-construtora/aprender';

const CATEGORY_LABELS: Record<string, string> = {
  civil: 'Civil', eletrica: 'Elétrica', hidraulica: 'Hidráulica',
  marcenaria: 'Marcenaria', vidros: 'Vidros', revestimento: 'Revestimento',
  pintura: 'Pintura', fachada: 'Fachada', climatizacao: 'Climatização', outro: 'Outro',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = pct >= 90 ? 'text-green-700' : pct >= 70 ? 'text-yellow-700' : 'text-red-700';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-gray-600">Cobertura do banco</span>
        <span className={textColor}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: 'green' | 'red' | 'yellow' | 'blue' | 'gray' }) {
  const classes = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
  }[variant];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes}`}>{label}</span>;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AprenderPage() {
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [analise, setAnalise] = useState<AnaliseResult | null>(null);
  const [allItemNames, setAllItemNames] = useState<string[]>([]); // nomes extraídos — reutilizados no re-match
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [verifyResult, setVerifyResult] = useState<AnaliseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<{
    added_variations: unknown[];
    added_items: unknown[];
    skipped?: { item_name: string; reason: string }[];
    errors: string[];
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ files: FileScan[]; summary: { total: number; needs_ai: number; skip_ai: number } } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming).filter(f =>
      /\.(pdf|dxf|dwg)$/i.test(f.name)
    );
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
    setScanResult(null); // reset scan when files change
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name));
    setScanResult(null);
  }

  // ─── Helpers de lote ─────────────────────────────────────────────────────

  /** Envia um único arquivo para um endpoint e retorna JSON. */
  async function postOneFile(action: string, file: File): Promise<Record<string, unknown>> {
    const fd = new FormData();
    fd.append('files', file, file.name);
    const res = await fetch(`${API}?action=${action}`, { method: 'POST', body: fd });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error(String(data.error ?? data.detail ?? `Erro ${res.status}`));
    return data;
  }

  // ─── Pre-scan — um arquivo de cada vez para não explodir a memória ───────

  async function handlePreScan() {
    if (files.length === 0) return;
    setScanning(true);
    setError(null);
    const allFileResults: FileScan[] = [];
    try {
      for (const file of files) {
        const data = await postOneFile('pre-scan', file);
        const fileResults = (data.files as FileScan[]) ?? [];
        allFileResults.push(...fileResults);
      }
      const needs_ai = allFileResults.filter(f => f.needs_ai).length;
      setScanResult({
        files: allFileResults,
        summary: { total: allFileResults.length, needs_ai, skip_ai: allFileResults.length - needs_ai },
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }

  // ─── Step 1: Analisar — em lotes de 3 arquivos para não crashar ──────────

  async function handleAnalisar() {
    if (files.length === 0) return;
    setError(null);
    setStep('analisando');

    const BATCH = 3;
    const allMatched: MatchedItem[] = [];
    const allUnmatched: string[] = [];
    const seenNames = new Set<string>();

    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const batch = files.slice(i, i + BATCH);
        const fd = new FormData();
        for (const f of batch) fd.append('files', f, f.name);
        const res = await fetch(`${API}?action=analisar`, { method: 'POST', body: fd });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data.error ?? data.detail ?? `Erro ${res.status}`));
        const result = data as unknown as AnaliseResult;

        for (const m of result.matched) {
          if (!seenNames.has(m.item_name)) { seenNames.add(m.item_name); allMatched.push(m); }
        }
        for (const u of result.unmatched) {
          if (!seenNames.has(u)) { seenNames.add(u); allUnmatched.push(u); }
        }
      }

      const total = allMatched.length + allUnmatched.length;
      const merged: AnaliseResult = {
        matched: allMatched,
        unmatched: allUnmatched,
        coverage_pct: total > 0 ? Math.round((allMatched.length / total) * 1000) / 10 : 0,
        total_items: total,
      };

      setAnalise(merged);
      setAllItemNames([...allMatched.map(m => m.item_name), ...allUnmatched]);
      setStep('analise');
    } catch (e) {
      setError(String(e));
      setStep('upload');
    }
  }

  // ─── Step 2: Chamar IA ───────────────────────────────────────────────────

  async function handleChamarIA() {
    if (!analise || analise.unmatched.length === 0) return;
    setError(null);
    setStep('sugerindo');

    try {
      const res = await fetch(`${API}?action=ia-sugerir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unmatched_items: analise.unmatched }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error ?? data.detail ?? `Erro ${res.status}`));
      const sugs: Suggestion[] = data.suggestions ?? [];
      setSuggestions(sugs);
      // Pré-seleciona apenas itens orçáveis com alta confiança
      const autoApproved = new Set(
        sugs
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => s.is_orcavel !== false && s.tipo !== 'ruido' && (s.confidence ?? 70) >= 80)
          .map(({ i }) => i)
      );
      setApproved(autoApproved);
      setStep('sugestoes');
    } catch (e) {
      setError(String(e));
      setStep('analise');
    }
  }

  // ─── Step 3: Atualizar banco ─────────────────────────────────────────────

  async function handleAtualizar() {
    const toApply = suggestions.filter((_, i) => approved.has(i));
    if (toApply.length === 0) return;
    setError(null);
    setStep('atualizando');

    try {
      const res = await fetch(`${API}?action=atualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: toApply }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error ?? data.detail ?? `Erro ${res.status}`));
      setUpdateResult(data as typeof updateResult);
      setStep('verificando');
    } catch (e) {
      setError(String(e));
      setStep('sugestoes');
    }
  }

  // ─── Step 4: Verificar (re-match leve — não re-processa PDFs) ──────────

  async function handleVerificar() {
    if (allItemNames.length === 0) return;
    setError(null);
    setStep('verificando');

    try {
      const res = await fetch(`${API}?action=re-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_names: allItemNames }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error ?? data.detail ?? `Erro ${res.status}`));
      setVerifyResult(data as unknown as AnaliseResult);
      setStep('verificado');
    } catch (e) {
      setError(String(e));
      setStep('verificando');
    }
  }

  function toggleApproval(i: number) {
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function reset() {
    setStep('upload');
    setFiles([]);
    setAnalise(null);
    setAllItemNames([]);
    setSuggestions([]);
    setApproved(new Set());
    setVerifyResult(null);
    setUpdateResult(null);
    setError(null);
    setScanResult(null);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const isLoading = step === 'analisando' || step === 'sugerindo' || step === 'atualizando' || step === 'verificando';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link href="/orcamento-construtora" className="text-sm text-blue-600 hover:underline mb-1 block">
              ← Orçamento Construtora
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Banco de Nomenclaturas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Analise projetos, descubra itens não mapeados e ensine o banco a reconhecê-los
            </p>
          </div>
          {step !== 'upload' && (
            <button onClick={reset} className="text-sm px-3 py-2 rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 font-medium flex-shrink-0">
              Recomeçar
            </button>
          )}
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-6 text-xs font-medium">
          {[
            { key: 'upload', label: '1. Upload' },
            { key: 'analise', label: '2. Análise' },
            { key: 'sugestoes', label: '3. Sugestões IA' },
            { key: 'verificado', label: '4. Verificação' },
          ].map(({ key, label }, idx, arr) => {
            const stepOrder = ['upload', 'analisando', 'analise', 'sugerindo', 'sugestoes', 'atualizando', 'verificando', 'verificado'];
            const current = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(key);
            const done = current > thisIdx;
            const active = current >= thisIdx && current < stepOrder.indexOf(arr[idx + 1]?.key ?? 'verificado') + (idx === arr.length - 1 ? 1 : 0);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full ${done ? 'bg-green-100 text-green-700' : active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? '✓ ' : ''}{label}
                </span>
                {idx < arr.length - 1 && <span className="text-gray-300">→</span>}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── STEP: Upload ── */}
        {(step === 'upload' || step === 'analisando') && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Selecione os arquivos do projeto</h2>
              <p className="text-sm text-gray-500">Arraste ou clique para adicionar PDFs e DXFs — pode jogar vários de uma vez</p>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-8 cursor-pointer text-center transition-colors ${
                dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.dxf,.dwg"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
              />
              <div className="text-3xl mb-2">📂</div>
              <p className="text-sm font-medium text-gray-700">Clique ou arraste arquivos aqui</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DXF, DWG — múltiplos arquivos suportados</p>
            </div>

            {/* Lista de arquivos selecionados */}
            {files.length > 0 && (
              <div className="space-y-2">
                {(() => {
                  const totalMB = files.reduce((s, f) => s + f.size, 0) / (1024 * 1024);
                  const warn = totalMB > 80;
                  return (
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {files.length} arquivo{files.length > 1 ? 's' : ''} —{' '}
                        <span className={warn ? 'text-amber-600 font-semibold' : 'text-gray-400'}>
                          {totalMB.toFixed(1)} MB total
                          {warn && ' ⚠ processado em lotes'}
                        </span>
                      </p>
                      <button onClick={() => { setFiles([]); setScanResult(null); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Limpar tudo</button>
                    </div>
                  );
                })()}
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {files.map((f) => {
                    const isPdf = f.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div key={f.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isPdf ? 'bg-blue-50' : 'bg-purple-50'}`}>
                        <span className="text-base">{isPdf ? '📄' : '📐'}</span>
                        <span className={`text-sm font-medium truncate flex-1 ${isPdf ? 'text-blue-800' : 'text-purple-800'}`}>{f.name}</span>
                        <span className={`text-xs flex-shrink-0 ${isPdf ? 'text-blue-500' : 'text-purple-500'}`}>{(f.size / 1024).toFixed(0)} KB</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0 text-xs ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pre-scan result */}
            {scanResult && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Diagnóstico de arquivos</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-700 font-medium">✓ {scanResult.summary.skip_ai} sem IA</span>
                    <span className="text-amber-700 font-medium">⚡ {scanResult.summary.needs_ai} com IA</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {scanResult.files.map((f) => (
                    <div key={f.filename} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="text-base mt-0.5 flex-shrink-0">{f.ext === 'pdf' ? '📄' : '📐'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 truncate">{f.filename}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                            f.needs_ai
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {f.needs_ai ? '⚡ precisa de IA' : '✓ só código'}
                          </span>
                          {f.size_kb > 0 && (
                            <span className="text-xs text-gray-400 flex-shrink-0">{f.size_kb} KB</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{f.reason}</p>
                        {!f.needs_ai && f.items_found > 0 && (
                          <p className="text-xs text-green-600 mt-0.5">
                            {f.tables_found > 0 ? `${f.tables_found} tabela(s) · ` : ''}{f.items_found} itens · {f.measures_found} medidas
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {scanResult.summary.needs_ai > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs text-amber-700">
                      {scanResult.summary.needs_ai} arquivo{scanResult.summary.needs_ai > 1 ? 's' : ''} será{scanResult.summary.needs_ai > 1 ? 'ão' : ''} enviado{scanResult.summary.needs_ai > 1 ? 's' : ''} à IA — os demais são processados localmente.
                    </p>
                  </div>
                )}
                {scanResult.summary.needs_ai === 0 && (
                  <div className="px-4 py-2 bg-green-50 border-t border-green-100">
                    <p className="text-xs text-green-700">Todos os arquivos podem ser processados sem IA — sem custo de tokens.</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePreScan}
                disabled={files.length === 0 || scanning || isLoading}
                className="flex-shrink-0 px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {scanning ? <><Spinner /> Verificando…</> : '🔍 Verificar'}
              </button>
              <button
                onClick={handleAnalisar}
                disabled={files.length === 0 || isLoading}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
              >
                {step === 'analisando'
                  ? <><Spinner /> Analisando {files.length} arquivo{files.length > 1 ? 's' : ''}…</>
                  : `Analisar ${files.length > 0 ? files.length + ' arquivo' + (files.length > 1 ? 's' : '') : 'projeto'}`
                }
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Análise ── */}
        {step === 'analise' && analise && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Resultado da análise</h2>
              <CoverageBar pct={analise.coverage_pct} />
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{analise.total_items}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Itens encontrados</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{analise.matched.length}</div>
                  <div className="text-xs text-green-600 mt-0.5">Reconhecidos</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{analise.unmatched.length}</div>
                  <div className="text-xs text-red-600 mt-0.5">Não mapeados</div>
                </div>
              </div>
            </div>

            {/* Itens não mapeados */}
            {analise.unmatched.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Itens não reconhecidos</h3>
                  <Badge label={`${analise.unmatched.length} itens`} variant="red" />
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {analise.unmatched.map((name) => (
                    <div key={name} className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                      <span className="text-red-400 text-xs">✗</span>
                      <span className="text-sm text-red-800 font-mono">{name}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleChamarIA}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  Chamar IA para mapear →
                </button>
              </div>
            )}

            {/* Itens reconhecidos */}
            {analise.matched.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Itens reconhecidos</h3>
                  <Badge label={`${analise.matched.length} itens`} variant="green" />
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {analise.matched.map((m) => (
                    <div key={m.item_name} className="flex items-center justify-between gap-2 px-3 py-2 bg-green-50 rounded-lg">
                      <span className="text-sm text-green-800 font-mono truncate">{m.item_name}</span>
                      <span className="text-xs text-green-600 flex-shrink-0">→ {m.matched_to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analise.unmatched.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="font-semibold text-green-800">100% de cobertura!</p>
                <p className="text-sm text-green-600 mt-1">Todos os itens foram reconhecidos pelo banco.</p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Sugerindo ── */}
        {step === 'sugerindo' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-3">
            <div className="flex justify-center"><Spinner /></div>
            <p className="font-medium text-gray-700">Consultando IA para mapear itens desconhecidos…</p>
            <p className="text-sm text-gray-400">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* ── STEP: Sugestões ── */}
        {step === 'sugestoes' && suggestions.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Sugestões da IA</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setApproved(new Set(
                      suggestions.map((s, i) => ({ s, i }))
                        .filter(({ s }) => s.is_orcavel !== false && s.tipo !== 'ruido')
                        .map(({ i }) => i)
                    ))}
                    className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    Aprovar orçáveis
                  </button>
                  <button onClick={() => setApproved(new Set())} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Desmarcar tudo</button>
                </div>
              </div>

              {/* Estatísticas rápidas */}
              <div className="flex gap-3 text-xs">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  {suggestions.filter(s => s.is_orcavel !== false && s.tipo !== 'ruido').length} orçáveis
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                  {suggestions.filter(s => s.is_orcavel === false || s.tipo === 'ruido').length} ruído filtrado
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  {approved.size} selecionados
                </span>
              </div>

              <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1">
                {suggestions.map((sug, i) => {
                  const isNoise = sug.is_orcavel === false || sug.tipo === 'ruido';
                  const conf = sug.confidence ?? 70;
                  const confColor = conf >= 85 ? 'text-green-600' : conf >= 60 ? 'text-yellow-600' : 'text-red-500';

                  return (
                    <div
                      key={i}
                      onClick={() => !isNoise && toggleApproval(i)}
                      className={`rounded-xl border-2 p-3.5 transition-all ${
                        isNoise
                          ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                          : approved.has(i)
                            ? 'border-blue-400 bg-blue-50 cursor-pointer'
                            : 'border-gray-200 bg-white opacity-70 cursor-pointer hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isNoise ? 'border-gray-200 bg-gray-100' : approved.has(i) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}>
                          {isNoise && <span className="text-gray-300 text-xs">✗</span>}
                          {!isNoise && approved.has(i) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`text-sm font-mono font-medium truncate ${isNoise ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {sug.item_name}
                            </span>
                            {isNoise ? (
                              <Badge label="Ruído" variant="gray" />
                            ) : (
                              <>
                                <Badge
                                  label={sug.tipo === 'variacao' ? 'Variação' : 'Novo item'}
                                  variant={sug.tipo === 'variacao' ? 'blue' : 'yellow'}
                                />
                                {sug.tipo === 'novo' && !sug.has_price && (
                                  <Badge label="Sem preço" variant="red" />
                                )}
                              </>
                            )}
                            <span className={`text-xs font-medium ml-auto flex-shrink-0 ${confColor}`}>
                              {conf}% conf.
                            </span>
                          </div>

                          {!isNoise && sug.tipo === 'variacao' && sug.target_id && (
                            <p className="text-xs text-gray-600">
                              → variação de <span className="font-medium text-blue-700">{sug.target_id}</span>
                            </p>
                          )}

                          {!isNoise && sug.tipo === 'novo' && (
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className="text-xs font-medium text-gray-700">{sug.canonical_name}</span>
                              {sug.category && <Badge label={CATEGORY_LABELS[sug.category] ?? sug.category} variant="gray" />}
                              {sug.unit && <Badge label={sug.unit} variant="gray" />}
                            </div>
                          )}

                          <p className="text-xs text-gray-400 mt-0.5 italic">{sug.rationale}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">
                  {approved.size} de {suggestions.length} sugestões selecionadas
                  {suggestions.some((s, i) => approved.has(i) && s.tipo === 'novo') && (
                    <span className="ml-2 text-amber-600 font-medium">
                      · Novos itens precisarão de preço cadastrado manualmente
                    </span>
                  )}
                </p>
                <button
                  onClick={handleAtualizar}
                  disabled={approved.size === 0}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Atualizar banco com {approved.size} sugestão{approved.size !== 1 ? 'ões' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Atualizando ── */}
        {step === 'atualizando' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-3">
            <div className="flex justify-center"><Spinner /></div>
            <p className="font-medium text-gray-700">Atualizando banco de nomenclaturas…</p>
          </div>
        )}

        {/* ── STEP: Verificando ── */}
        {step === 'verificando' && (
          <div className="space-y-4">
            {updateResult && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
                <h2 className="font-semibold text-gray-900">Banco atualizado</h2>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-green-700">{updateResult.added_variations.length}</div>
                    <div className="text-xs text-green-600 mt-0.5">Variações</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-blue-700">{updateResult.added_items.length}</div>
                    <div className="text-xs text-blue-600 mt-0.5">Novos itens</div>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-yellow-700">{updateResult.skipped?.length ?? 0}</div>
                    <div className="text-xs text-yellow-600 mt-0.5">Duplicatas evitadas</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-red-700">{updateResult.errors.length}</div>
                    <div className="text-xs text-red-600 mt-0.5">Erros</div>
                  </div>
                </div>
                {(updateResult.skipped?.length ?? 0) > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs text-yellow-700 cursor-pointer hover:underline">
                      {updateResult.skipped!.length} duplicata(s) detectada(s) e ignorada(s)
                    </summary>
                    <div className="mt-1 space-y-1">
                      {updateResult.skipped!.map((s, i) => (
                        <p key={i} className="text-xs text-yellow-700 px-3 py-1.5 bg-yellow-50 rounded">
                          <span className="font-medium">{s.item_name}</span> — {s.reason}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                {updateResult.errors.length > 0 && (
                  <div className="space-y-1">
                    {updateResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 px-3 py-1.5 bg-red-50 rounded">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleVerificar}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              Conferir resultado →
            </button>
          </div>
        )}

        {/* ── STEP: Verificado ── */}
        {step === 'verificado' && verifyResult && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Verificação final</h2>
              <CoverageBar pct={verifyResult.coverage_pct} />
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{verifyResult.total_items}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Total de itens</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{verifyResult.matched.length}</div>
                  <div className="text-xs text-green-600 mt-0.5">Reconhecidos</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{verifyResult.unmatched.length}</div>
                  <div className="text-xs text-red-600 mt-0.5">Ainda não mapeados</div>
                </div>
              </div>

              {verifyResult.unmatched.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="font-semibold text-green-800">Cobertura completa! 🎉</p>
                  <p className="text-sm text-green-600 mt-1">Todos os itens do projeto estão mapeados no banco.</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-800 mb-2">Itens ainda não mapeados ({verifyResult.unmatched.length}):</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {verifyResult.unmatched.map((name) => (
                      <p key={name} className="text-xs text-amber-700 font-mono">{name}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Analisar outro projeto
              </button>
              <Link
                href="/orcamento-construtora"
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors text-center"
              >
                Voltar ao Orçamento
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
