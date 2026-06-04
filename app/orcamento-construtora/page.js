'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQtd(item) {
  if (item.unid === 'm2' || item.unid === 'm²') {
    const L = item.L ?? 0;
    const C = item.C ?? 0;
    if (L && C) return `${L} × ${C} = ${(L * C).toFixed(2)} m²`;
    if (item.qtd) return `${item.qtd} m²`;
  }
  if (item.L && (item.unid === 'ml' || item.unid === 'm')) return `${item.L} m`;
  if (item.qty != null) return `${item.qty} ${item.unid}`;
  if (item.qtd != null) return `${item.qtd} ${item.unid}`;
  return `— ${item.unid ?? ''}`;
}

const STATUS_STYLE = {
  confirmado: { dot: 'bg-green-500', label: '100% confirmado',         row: 'border-green-200 bg-green-50 text-green-800' },
  estimativa: { dot: 'bg-blue-400',  label: 'Estimativa — confirmar', row: 'border-blue-200 bg-blue-50 text-blue-800'   },
  pendencia:  { dot: 'bg-red-400',   label: 'Não mensurável',         row: 'border-red-200 bg-red-50 text-red-800'     },
  parcial:    { dot: 'bg-yellow-400',label: 'Parcial',                 row: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
  aguardando: { dot: 'bg-gray-400',  label: 'Aguardando',             row: 'border-gray-200 bg-gray-50 text-gray-800'  },
};

// ─── Image/file store (outside React state to avoid OOM) ─────────────────────

let _groups = [];
const imageStore = {
  set: (groups) => { _groups = groups; },
  get: ()        => _groups,
  clear: ()      => { _groups = []; },
};

function groupFilesByStem(files) {
  const map = new Map();
  for (const f of files) {
    const ext  = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : '';
    const stem = f.name.replace(/\.[^.]+$/, '');
    if (!map.has(stem)) map.set(stem, { stem, imageFile: null, pdfFile: null, dxfFile: null });
    const g = map.get(stem);
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) g.imageFile = f;
    else if (ext === 'pdf')                            g.pdfFile   = f;
    else if (['dxf', 'dwg'].includes(ext))            g.dxfFile   = f;
  }
  return [...map.values()].filter((g) => g.imageFile || g.pdfFile || g.dxfFile);
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const LS_KEY = 'orc-construtora-v3';
function savePersisted(s)  { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /**/ } }
function loadPersisted()   { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function clearPersisted()  { try { localStorage.removeItem(LS_KEY); } catch { /**/ } }

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ current, accessible, onNavigate }) {
  const steps = ['Upload', 'Extração', 'IA', 'Revisão', 'Orçamento'];
  return (
    <div className="flex items-center gap-0 w-full max-w-2xl mx-auto mb-8">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const done = current > num;
        const active = current === num;
        const clickable = (accessible?.has(num) ?? false) && num !== current;
        return (
          <div key={num} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <button
                onClick={() => clickable && onNavigate(num)}
                disabled={!clickable}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  done   ? 'bg-green-500 text-white' :
                  active ? 'bg-blue-600 text-white' :
                           'bg-gray-200 text-gray-500'
                } ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {done ? '✓' : num}
              </button>
              <span className={`text-xs mt-1 ${active ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-4 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Upload ─────────────────────────────────────────────────────────

function StepUpload({ onDone }) {
  const [files, setFiles]   = useState([]);
  const [phase, setPhase]   = useState('idle');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const ACCEPTED = '.png,.jpg,.jpeg,.webp,.pdf,.dxf,.dwg';

  const handleFiles = (incoming) => {
    const valid = [...incoming].filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'dxf', 'dwg'].includes(ext);
    });
    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > 0) setPhase('confirming');
      return merged;
    });
  };

  const proceed = () => {
    const groups = groupFilesByStem(files);
    if (!groups.length) return;
    imageStore.set(groups);
    onDone(groups);
  };

  const groups = useMemo(() => groupFilesByStem(files), [files]);

  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-xl font-semibold text-gray-800">Passo 1 — Upload das Pranchas</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Envie PNG, PDF e/ou DXF/DWG. Arquivos com o mesmo nome (stem) serão agrupados como uma prancha.
        </p>
        <div
          className={`w-full max-w-md border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="text-4xl">📐</span>
          <p className="text-sm text-gray-600 font-medium">Arraste os arquivos aqui ou clique para selecionar</p>
          <p className="text-xs text-gray-400">PNG · JPG · PDF · DXF · DWG — múltiplos arquivos</p>
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Pronto para extrair</h2>
        <p className="text-sm text-gray-500 mt-1">
          <span className="font-semibold text-gray-800">{groups.length}</span> prancha{groups.length !== 1 ? 's' : ''} identificada{groups.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="w-full max-w-lg border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs font-medium text-gray-500">
          <span>Prancha</span>
          <span className="text-center w-10">PNG</span>
          <span className="text-center w-10">PDF</span>
          <span className="text-center w-10">DXF</span>
        </div>
        {groups.map((g) => (
          <div key={g.stem} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 text-sm items-center">
            <span className="font-mono text-xs truncate text-gray-700">{g.stem}</span>
            <span className={`text-center w-10 text-xs font-medium ${g.imageFile ? 'text-blue-600' : 'text-gray-300'}`}>{g.imageFile ? '✓' : '—'}</span>
            <span className={`text-center w-10 text-xs font-medium ${g.pdfFile ? 'text-blue-600' : 'text-gray-300'}`}>{g.pdfFile ? '✓' : '—'}</span>
            <span className={`text-center w-10 text-xs font-medium ${g.dxfFile ? 'text-blue-600' : 'text-gray-300'}`}>{g.dxfFile ? '✓' : '—'}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={proceed}
          disabled={groups.length === 0}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Extrair por Código →
        </button>
        <button
          onClick={() => { setPhase('idle'); setFiles([]); }}
          className="w-full py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-all"
        >
          ← Alterar arquivos
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Extração por Código ────────────────────────────────────────────

const CLASS_BADGE = {
  DIRETO:       'bg-green-100 text-green-700',
  IA_AUDITORIA: 'bg-yellow-100 text-yellow-700',
  IA_NECESSARIA:'bg-orange-100 text-orange-700',
  SEM_CONTEUDO: 'bg-gray-100 text-gray-500',
};

function PranchaCard({ result, imageFile, onViewImage }) {
  const [open, setOpen] = useState(false);
  const cls = CLASS_BADGE[result.classificacao] ?? CLASS_BADGE.SEM_CONTEUDO;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-gray-800 truncate">{result.stem}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{result.classificacao}</span>
            <span className="text-xs text-gray-500">{result.n_itens_extraidos} itens</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result.erro ? (
            <span className="text-xs text-red-600 font-medium">Erro</span>
          ) : (
            <span className="text-xs text-green-600 font-medium">OK</span>
          )}
          {imageFile && (
            <button
              onClick={() => onViewImage(imageFile)}
              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Ver Imagem
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {open ? '▲' : '▼'} debug
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
            {JSON.stringify(result.debug ?? result, null, 2)}
          </pre>
        </div>
      )}
      {result.erro && (
        <div className="border-t border-red-100 px-4 py-2 bg-red-50">
          <p className="text-xs text-red-600">{result.erro}</p>
        </div>
      )}
    </div>
  );
}

function StepExtract({ groups, existingResults, onDone, onNavigateIA }) {
  const [results, setResults]   = useState(existingResults ?? []);
  const [running, setRunning]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [viewUrl, setViewUrl]   = useState(null);
  const runRef = useRef(false);

  const run = useCallback(async () => {
    if (runRef.current || groups.length === 0) return;
    runRef.current = true;
    setRunning(true);
    setResults([]);
    const out = [];
    for (let i = 0; i < groups.length; i++) {
      setCurrent(i + 1);
      const g = groups[i];
      const fd = new FormData();
      if (g.imageFile) fd.append('image', g.imageFile, g.imageFile.name);
      if (g.pdfFile)   fd.append('pdf',   g.pdfFile,   g.pdfFile.name);
      if (g.dxfFile)   fd.append('dxf',   g.dxfFile,   g.dxfFile.name);
      let result;
      try {
        const r = await fetch('/api/orcamento-construtora/extrair-codigo', { method: 'POST', body: fd });
        const data = await r.json();
        if (!r.ok) throw new Error(data.erro ?? `HTTP ${r.status}`);
        result = { stem: g.stem, ...data };
      } catch (e) {
        result = { stem: g.stem, erro: e.message, classificacao: 'SEM_CONTEUDO', n_itens_extraidos: 0, itens_extraidos: [], precisa_ia: false };
      }
      // Use client-side stem (g.stem) as canonical name
      result.stem = g.stem;
      out.push(result);
      setResults([...out]);
    }
    setRunning(false);
    runRef.current = false;
    onDone(out);
  }, [groups, onDone]);

  // Auto-run on mount if no existing results
  useEffect(() => {
    if (!existingResults?.length) run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const needIA    = results.filter((r) => r.precisa_ia).length;
  const suficiente = results.filter((r) => !r.precisa_ia && !r.erro).length;
  const erros     = results.filter((r) => r.erro).length;
  const done      = !running && results.length === groups.length && groups.length > 0;

  const handleView = (file) => {
    if (viewUrl) URL.revokeObjectURL(viewUrl);
    setViewUrl(URL.createObjectURL(file));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Passo 2 — Extração por Código</h2>
        <p className="text-sm text-gray-500 mt-1">
          Lê PDF e DXF de cada prancha sem chamar IA. Rápido e sem custo.
        </p>
      </div>

      {/* Progress */}
      {running && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Processando prancha {current}/{groups.length}…</span>
            <span className="text-xs text-gray-400">{Math.round((current / groups.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(current / groups.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {done && (
        <div className="flex gap-4 flex-wrap text-sm">
          <span className="flex items-center gap-1.5 text-green-700"><span className="w-2 h-2 rounded-full bg-green-500" />{suficiente} suficientes</span>
          <span className="flex items-center gap-1.5 text-orange-700"><span className="w-2 h-2 rounded-full bg-orange-400" />{needIA} precisam de IA</span>
          {erros > 0 && <span className="flex items-center gap-1.5 text-red-700"><span className="w-2 h-2 rounded-full bg-red-400" />{erros} erros</span>}
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {results.map((r) => {
          const g = groups.find((g) => g.stem === r.stem);
          return (
            <PranchaCard
              key={r.stem}
              result={r}
              imageFile={g?.imageFile ?? null}
              onViewImage={handleView}
            />
          );
        })}
        {running && results.length < groups.length && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-blue-700 font-mono">
              {groups[results.length]?.stem ?? '…'}
            </span>
          </div>
        )}
      </div>

      {/* Image viewer */}
      {viewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setViewUrl(null)}>
          <img src={viewUrl} alt="Prancha" className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white text-2xl font-light hover:text-gray-300" onClick={() => setViewUrl(null)}>✕</button>
        </div>
      )}

      {done && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={run}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            Re-extrair
          </button>
          {needIA > 0 && (
            <button
              onClick={() => onNavigateIA(results)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              Analisar com IA ({needIA} pranchas) →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 3 — IA (Orquestrador + Batches) — clicável estágio a estágio ───────

function BatchCard({ br }) {
  const [open, setOpen] = useState(false);
  const stemsList = br.stems.join(', ');
  const itensPorStem = br.batched ?? {};

  return (
    <div className={`border rounded-xl overflow-hidden ${br.erro ? 'border-red-200' : 'border-gray-200'}`}>
      <button
        onClick={() => !br.erro && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${br.erro ? 'bg-red-50' : 'bg-gray-50 hover:bg-gray-100'}`}
      >
        <span className={`font-bold text-sm flex-shrink-0 ${br.erro ? 'text-red-600' : 'text-green-600'}`}>
          {br.erro ? '✕' : '✓'}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">Batch {br.batch}</span>
          <span className="text-xs text-gray-500 ml-2">{stemsList}</span>
        </div>
        {!br.erro && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400">
              {Object.values(itensPorStem).reduce((s, arr) => s + arr.length, 0)} itens
            </span>
            <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
          </div>
        )}
      </button>

      {br.erro && (
        <div className="px-4 py-2 text-xs text-red-600">{br.erro}</div>
      )}

      {open && !br.erro && (
        <div className="divide-y divide-gray-100">
          {Object.entries(itensPorStem).map(([stem, itens]) => (
            <div key={stem} className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-700 mb-2 font-mono">{stem} — {itens.length} itens</p>
              <div className="flex flex-col gap-1.5">
                {itens.map((it, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${it.fonte === 'PDF' ? 'bg-green-400' : 'bg-blue-400'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{it.descricao}</span>
                      <span className="text-gray-400 ml-1">· {it.quantidade ?? '?'} {it.unidade ?? it.unid ?? ''}</span>
                      {it.ambiente && <span className="text-gray-400 ml-1">· {it.ambiente}</span>}
                    </div>
                    <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      it.fonte === 'PDF' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                    }`}>{it.fonte ?? 'IA'}</span>
                    <span className="flex-shrink-0 text-gray-300 text-xs">{it.confianca ?? '—'}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepIA({ groups, extractResults, existingOrchResult, onDone }) {
  // stage: 'idle' | 'running_orch' | 'orch_done' | 'running_batches' | 'batch_done'
  const [stage, setStage]               = useState(existingOrchResult ? 'orch_done' : 'idle');
  const [orchRunning, setOrchRunning]   = useState(false);
  const [orchResult, setOrchResult]     = useState(existingOrchResult ?? null);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchResults, setBatchResults] = useState([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [tokenLogs, setTokenLogs]       = useState([]);
  const [erro, setErro]                 = useState('');
  const [finalItems, setFinalItems]     = useState(null);
  const runRef = useRef(false);

  const addTokenLog = useCallback((label, meta) => {
    setTokenLogs((prev) => [...prev, { stage: label, usage: { input_tokens: meta.tokens_input ?? 0, output_tokens: meta.tokens_output ?? 0 } }]);
  }, []);

  // ── Merge helper ──────────────────────────────────────────────────────────

  const mergeResults = useCallback((allBatched) => {
    return extractResults.map((er) => {
      const iaItems   = allBatched[er.stem] ?? [];
      const codeItems = (er.itens_extraidos ?? []).map((it) => ({ ...it, fonte: it.fonte ?? 'PDF', status: it.status ?? 'confirmado' }));
      const merged    = [...codeItems];
      for (const ia of iaItems) {
        const dup = merged.find((c) => c.descricao?.toLowerCase() === ia.descricao?.toLowerCase());
        if (!dup) merged.push({ ...ia, _id: Math.random() });
      }
      return { stem: er.stem, itens: merged };
    });
  }, [extractResults]);

  // ── Estágio 1: Orquestrador ───────────────────────────────────────────────

  const runOrchestrator = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;
    setOrchRunning(true);
    setErro('');
    setStage('running_orch');

    const richest = extractResults.reduce((best, r) =>
      (r.n_itens_extraidos ?? 0) > (best.n_itens_extraidos ?? 0) ? r : best, extractResults[0]);
    const richGroup = groups.find((g) => g.stem === richest?.stem);

    const extract_summary = extractResults.map((r) => ({
      stem:            r.stem,
      classificacao:   r.classificacao,
      n_itens:         r.n_itens_extraidos ?? 0,
      score:           r.debug?.score ?? 0,
      precisa_ia:      r.precisa_ia,
      itens_extraidos: (r.itens_extraidos ?? []).slice(0, 5),
    }));
    const file_list = groups
      .map((g) => [g.imageFile?.name, g.pdfFile?.name, g.dxfFile?.name].filter(Boolean))
      .flat();

      const fd = new FormData();
    if (richGroup?.imageFile) fd.append('image', richGroup.imageFile, richGroup.imageFile.name);
    fd.append('context_json', JSON.stringify({ extract_summary, file_list }));

    let orch;
    try {
      const r    = await fetch('/api/orcamento-construtora/orquestrar', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro ?? `HTTP ${r.status}`);
      orch = data;
    } catch (e) {
      setErro(`Orquestrador: ${e.message}`);
      setOrchRunning(false);
      setStage('idle');
      runRef.current = false;
      return;
    }

    addTokenLog('Orquestrador', orch.metadata ?? {});
    setOrchResult(orch);
    setOrchRunning(false);
    setStage('orch_done');
    runRef.current = false;
  }, [extractResults, groups, addTokenLog]);

  // ── Estágio 2: Batches ───────────────────────────────────────────────────

  const runBatches = useCallback(async () => {
    if (runRef.current || !orchResult) return;
    runRef.current = true;
    setBatchRunning(true);
    setStage('running_batches');
    setErro('');

    const selected = (orchResult.pranchas_selecionadas ?? []).map((p) => p.stem);
    const stems    = selected.length > 0
      ? selected
      : extractResults.filter((r) => r.precisa_ia).map((r) => r.stem);

    const BATCH_SIZE = 3;
    const batches = [];
    for (let i = 0; i < stems.length; i += BATCH_SIZE) {
      batches.push(stems.slice(i, i + BATCH_SIZE));
    }

    setBatchProgress({ done: 0, total: batches.length });
    const allBatched = {};

    for (let bi = 0; bi < batches.length; bi++) {
      const batchStems = batches[bi];
      const fd         = new FormData();
      const batch_items = [];

      for (let j = 0; j < batchStems.length; j++) {
        const stem = batchStems[j];
        const g  = groups.find((g) => g.stem === stem);
        const er = extractResults.find((r) => r.stem === stem);
        if (g?.imageFile) fd.append(`image_${j}`, g.imageFile, g.imageFile.name);
        batch_items.push({
          stem,
          itens_extraidos: er?.itens_extraidos ?? [],
          classificacao:   er?.classificacao ?? 'IA_NECESSARIA',
        });
      }
      fd.append('context_json', JSON.stringify({
        contexto_projeto: orchResult.contexto_projeto ?? 'Projeto de fit-out',
        batch_items,
      }));

      let batchData;
      try {
        const r    = await fetch('/api/orcamento-construtora/analisar-batch', { method: 'POST', body: fd });
      const data = await r.json();
        if (!r.ok) throw new Error(data.erro ?? `HTTP ${r.status}`);
        batchData = data;
      } catch (e) {
        setErro((prev) => (prev ? prev + '\n' : '') + `Batch ${bi + 1}: ${e.message}`);
        setBatchResults((prev) => [...prev, { batch: bi + 1, stems: batchStems, erro: e.message }]);
        setBatchProgress((p) => ({ ...p, done: p.done + 1 }));
        continue;
      }

      addTokenLog(`Batch ${bi + 1}/${batches.length}`, batchData.metadata ?? {});
      Object.assign(allBatched, batchData.batched ?? {});
      setBatchResults((prev) => [...prev, { batch: bi + 1, stems: batchStems, batched: batchData.batched }]);
      setBatchProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    const merged = mergeResults(allBatched);
    setFinalItems(merged);
    setBatchRunning(false);
    setStage('batch_done');
    runRef.current = false;
  }, [orchResult, groups, extractResults, addTokenLog, mergeResults]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalTokens = tokenLogs.reduce((s, l) => s + (l.usage?.input_tokens ?? 0) + (l.usage?.output_tokens ?? 0), 0);
  const totalCusto  = tokenLogs.reduce((s, l) =>
    s + (l.usage?.input_tokens ?? 0) * 3 / 1_000_000 + (l.usage?.output_tokens ?? 0) * 15 / 1_000_000, 0);

  const nSelected   = (orchResult?.pranchas_selecionadas ?? []).length;
  const nBatches    = Math.ceil(nSelected / 3) || 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Passo 3 — Análise com IA</h2>
          <p className="text-sm text-gray-500 mt-1">
          Dois estágios: orquestrador entende o projeto, depois batches de até 3 pranchas por chamada.
          </p>
      </div>

      {/* ─── Estágio 1: Orquestrador ─────────────────────────────────────── */}
      <div className={`border rounded-xl overflow-hidden ${
        orchResult ? 'border-green-200' : orchRunning ? 'border-blue-200' : 'border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-4 py-3 flex items-center gap-3 ${
          orchResult ? 'bg-green-50' : orchRunning ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          {orchResult
            ? <span className="text-green-600 font-bold text-sm flex-shrink-0">✓</span>
            : orchRunning
                  ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <span className="w-5 h-5 rounded-full border-2 border-gray-300 inline-flex items-center justify-center text-xs text-gray-400 flex-shrink-0">1</span>
          }
          <div className="flex-1">
            <p className={`text-sm font-semibold ${orchResult ? 'text-green-800' : orchRunning ? 'text-blue-800' : 'text-gray-700'}`}>
              Estágio 1 — Orquestrador
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {orchRunning
                ? 'Enviando prancha âncora + sumário de extração…'
                : orchResult
                ? `${nSelected} pranchas selecionadas · ${nBatches} batch${nBatches !== 1 ? 'es' : ''} estimados`
                : `Enviará a prancha mais rica + sumário de ${extractResults.length} pranchas`}
            </p>
          </div>
          {!orchResult && !orchRunning && (
            <button
              onClick={runOrchestrator}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              Executar →
            </button>
          )}
          {orchRunning && (
            <span className="flex-shrink-0 text-xs text-blue-500 animate-pulse">aguardando IA…</span>
          )}
        </div>

        {/* Output do orquestrador */}
        {orchResult && (
          <div className="px-4 py-4 flex flex-col gap-3 border-t border-green-100">

            {/* Contexto do projeto */}
            <div className="bg-white border border-gray-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contexto do Projeto</p>
              <p className="text-sm text-gray-800 italic">"{orchResult.contexto_projeto}"</p>
              <div className="flex gap-3 mt-2 text-xs text-gray-500">
                <span>Cliente: <span className="font-medium text-gray-700">{orchResult.cliente}</span></span>
                <span>Projeto: <span className="font-medium text-gray-700">{orchResult.projeto}</span></span>
              </div>
            </div>

            {/* Pranchas selecionadas */}
            {(orchResult.pranchas_selecionadas ?? []).length > 0 && (
                <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Pranchas selecionadas para análise visual ({orchResult.pranchas_selecionadas.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {orchResult.pranchas_selecionadas.map((p) => (
                    <div key={p.stem} className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs">
                      <span className="font-mono font-semibold text-orange-800 flex-shrink-0">{p.stem}</span>
                      <span className="text-orange-600">— {p.motivo}</span>
                      <span className="ml-auto flex-shrink-0 text-orange-400">P{p.prioridade}</span>
                </div>
                  ))}
              </div>
        </div>
      )}

            {/* Pranchas dispensadas */}
            {(orchResult.pranchas_dispensadas ?? []).length > 0 && (
              <details className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  {orchResult.pranchas_dispensadas.length} pranchas dispensadas (sem análise visual) ▾
                </summary>
                <div className="mt-2 flex flex-col gap-1">
                  {orchResult.pranchas_dispensadas.map((p) => (
                    <div key={p.stem} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-mono text-gray-600 flex-shrink-0">{p.stem}</span>
                      <span className="text-gray-400">— {p.motivo}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Gaps */}
            {(orchResult.gaps_identificados ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gaps identificados</p>
                <div className="flex flex-wrap gap-1.5">
                  {orchResult.gaps_identificados.map((g, i) => (
                    <span key={i} className="text-xs bg-red-50 border border-red-100 text-red-600 px-2 py-0.5 rounded-full">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Token info */}
            {tokenLogs[0] && (
              <p className="text-xs text-gray-400">
                Tokens: {((tokenLogs[0].usage?.input_tokens ?? 0) + (tokenLogs[0].usage?.output_tokens ?? 0)).toLocaleString('pt-BR')} ·{' '}
                ${((tokenLogs[0].usage?.input_tokens ?? 0) * 3 / 1_000_000 + (tokenLogs[0].usage?.output_tokens ?? 0) * 15 / 1_000_000).toFixed(4)} USD
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── Estágio 2: Batches ──────────────────────────────────────────── */}
      <div className={`border rounded-xl overflow-hidden ${
        stage === 'batch_done' ? 'border-green-200' : batchRunning ? 'border-blue-200' : 'border-gray-200'
      }`}>
        {/* Header */}
        <div className={`px-4 py-3 flex items-center gap-3 ${
          stage === 'batch_done' ? 'bg-green-50' : batchRunning ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          {stage === 'batch_done'
            ? <span className="text-green-600 font-bold text-sm flex-shrink-0">✓</span>
            : batchRunning
            ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <span className="w-5 h-5 rounded-full border-2 border-gray-300 inline-flex items-center justify-center text-xs text-gray-400 flex-shrink-0">2</span>
          }
          <div className="flex-1">
            <p className={`text-sm font-semibold ${stage === 'batch_done' ? 'text-green-800' : batchRunning ? 'text-blue-800' : 'text-gray-500'}`}>
              Estágio 2 — Análise Visual em Batches de 3
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {batchRunning
                ? `Batch ${batchProgress.done + 1}/${batchProgress.total} em andamento…`
                : stage === 'batch_done'
                ? `${batchProgress.total} batch${batchProgress.total !== 1 ? 'es' : ''} concluídos`
                : orchResult
                ? `${nSelected} pranchas → ${nBatches} batch${nBatches !== 1 ? 'es' : ''} de até 3 imagens cada`
                : 'Aguardando Estágio 1'}
            </p>
          </div>
          {orchResult && !batchRunning && stage !== 'batch_done' && (
            <button
              onClick={runBatches}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              Analisar ({nSelected}) →
            </button>
          )}
          {batchRunning && (
            <span className="flex-shrink-0 text-xs text-blue-500 animate-pulse">
              {batchProgress.done}/{batchProgress.total} batches…
                </span>
          )}
        </div>

        {/* Progresso */}
        {(batchRunning || batchResults.length > 0) && batchProgress.total > 0 && (
          <div className="px-4 pt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
              />
          </div>
        </div>
      )}

        {/* Cards dos batches */}
        {batchResults.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-3">
            {batchResults.map((br) => <BatchCard key={br.batch} br={br} />)}
          </div>
        )}

        {/* Token info dos batches */}
        {tokenLogs.length > 1 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400">
              Batches: {tokenLogs.slice(1).reduce((s, l) => s + (l.usage?.input_tokens ?? 0) + (l.usage?.output_tokens ?? 0), 0).toLocaleString('pt-BR')} tokens ·{' '}
              ${tokenLogs.slice(1).reduce((s, l) => s + (l.usage?.input_tokens ?? 0) * 3 / 1_000_000 + (l.usage?.output_tokens ?? 0) * 15 / 1_000_000, 0).toFixed(4)} USD
            </p>
          </div>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 whitespace-pre-wrap break-all">
          {erro}
        </pre>
      )}

      {/* Resumo total + CTA */}
      {finalItems && (
        <div className="flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xs text-gray-500 flex gap-4">
            <span>{totalTokens.toLocaleString('pt-BR')} tokens totais</span>
            <span className="font-semibold text-gray-700">${totalCusto.toFixed(4)} USD</span>
            <span>{finalItems.reduce((s, g) => s + g.itens.length, 0)} itens identificados</span>
          </div>
        <button
            onClick={() => onDone(finalItems, orchResult, tokenLogs)}
            className="flex-shrink-0 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 active:scale-95 transition-all"
        >
            Ver Revisão →
          </button>
        </div>
        )}
    </div>
  );
}

// ─── Step 4 — Revisão ─────────────────────────────────────────────────────────

function ItemCard({ item, onRemove }) {
  const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.estimativa;
  return (
    <div className={`rounded-lg border p-3 ${st.row}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono opacity-60">{item.cod ?? '?'}</span>
            <span className="text-sm font-semibold">{item.descricao}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${st.row}`}>{st.label}</span>
            {item.material_cliente && <span className="text-xs text-amber-700 font-medium">⚠ mat. cliente</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs font-medium opacity-80">
            <span>📍 {item.ambiente ?? '—'}</span>
            <span>📐 {fmtQtd(item)}</span>
            <span className="text-gray-400">{item.fonte ?? '?'}</span>
            {item.prancha && <span className="text-gray-400">{item.prancha}</span>}
          </div>
          {item.observacao && <p className="text-xs opacity-60 mt-1 italic">{item.observacao}</p>}
        </div>
        <button onClick={() => onRemove(item._id)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-xs">
          ✕
        </button>
      </div>
    </div>
  );
}

function StepReview({ mergedData, imageGroups, onDone }) {
  const rawItens = useMemo(() => {
    if (!mergedData) return [];
    return mergedData.flatMap((g) =>
      (g.itens ?? []).map((it, i) => ({ ...it, _id: `${g.stem}-${i}`, _stem: g.stem }))
    );
  }, [mergedData]);

  const [itens, setItens] = useState(rawItens);

  const porAmbiente = useMemo(() => {
    const mapa = new Map();
    for (const item of itens) {
      const amb = item.ambiente ?? 'sem ambiente';
      if (!mapa.has(amb)) mapa.set(amb, []);
      mapa.get(amb).push(item);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [itens]);

  const confirmados = itens.filter((i) => i.status === 'confirmado').length;
  const estimativas = itens.filter((i) => i.status === 'estimativa' || i.status === 'parcial').length;
  const pendencias  = itens.filter((i) => i.status === 'pendencia' || i.status === 'aguardando').length;

  const removeItem = (id) => setItens((prev) => prev.filter((i) => i._id !== id));

  const [viewingIdx, setViewingIdx] = useState(0);
  const [imageUrls, setImageUrls]   = useState([]);
  const stemOrder = useMemo(() => (mergedData ?? []).map((g) => g.stem), [mergedData]);

  useEffect(() => {
    const urls = stemOrder.map((stem) => {
      const g = imageGroups?.find((g) => g.stem === stem);
      return g?.imageFile ? URL.createObjectURL(g.imageFile) : null;
    }).filter(Boolean);
    setImageUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageGroups, stemOrder]);

  return (
    <div className="flex gap-5 w-full items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Passo 4 — Revisão</h2>
          <div className="mt-2 flex gap-3 flex-wrap text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{confirmados} confirmados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{estimativas} estimativas</span>
            {pendencias > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{pendencias} pendências</span>}
          </div>
        </div>

        {porAmbiente.map(([ambiente, ambItens]) => (
          <div key={ambiente} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full inline-block" />
                {ambiente}
                <span className="text-gray-400 font-normal">({ambItens.length})</span>
              </h3>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {ambItens.map((item) => (
                <ItemCard key={item._id} item={item} onRemove={removeItem} />
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3 items-center justify-end pt-1">
          <button onClick={() => onDone(itens)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all">
            Calcular Orçamento →
          </button>
        </div>
      </div>

      {imageUrls.length > 0 && (
        <div className="flex-shrink-0 sticky top-0 self-start" style={{ width: '900px' }}>
          <div className="rounded-xl overflow-hidden bg-gray-900 shadow-xl flex flex-col" style={{ height: 'calc(100vh - 32px)' }}>
            <div className="relative bg-gray-950 flex items-center justify-center flex-1 min-h-0">
              {imageUrls[viewingIdx] ? (
                <img key={viewingIdx} src={imageUrls[viewingIdx]} alt={`Prancha ${viewingIdx + 1}`}
                  className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <span className="text-5xl">🖼</span>
                  <p className="text-sm">Sem imagem</p>
                </div>
              )}
              <button onClick={() => setViewingIdx((i) => Math.max(0, i - 1))} disabled={viewingIdx === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-12 h-20 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm text-4xl font-thin select-none">
                ‹
              </button>
              <button onClick={() => setViewingIdx((i) => Math.min(imageUrls.length - 1, i + 1))} disabled={viewingIdx >= imageUrls.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-12 h-20 flex items-center justify-center rounded-xl bg-black/50 hover:bg-black/80 text-white disabled:opacity-20 transition-all backdrop-blur-sm text-4xl font-thin select-none">
                ›
              </button>
            </div>
            <div className="h-11 bg-gray-800 px-2 flex items-center gap-1">
              <div className="flex-1 flex gap-1 overflow-x-auto py-1">
                {imageUrls.map((url, i) => (
                  <button key={i} onClick={() => setViewingIdx(i)} title={stemOrder[i] ?? `Prancha ${i + 1}`}
                    className={`flex-shrink-0 rounded overflow-hidden border-2 transition-all ${i === viewingIdx ? 'border-blue-400' : 'border-transparent opacity-40 hover:opacity-75'}`}>
                    <img src={url} alt={`p${i + 1}`} className="h-7 w-10 object-cover" />
                  </button>
                ))}
              </div>
              <span className="text-gray-500 text-xs ml-2 flex-shrink-0">
                {viewingIdx + 1}/{imageUrls.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 5 — Orçamento ───────────────────────────────────────────────────────

function TokenLogPanel({ logs }) {
  const [open, setOpen] = useState(false);
  const PRICE_IN  = 3 / 1_000_000;
  const PRICE_OUT = 15 / 1_000_000;
  const totalInput  = logs.reduce((s, l) => s + (l.usage?.input_tokens ?? 0), 0);
  const totalOutput = logs.reduce((s, l) => s + (l.usage?.output_tokens ?? 0), 0);
  const totalCost   = totalInput * PRICE_IN + totalOutput * PRICE_OUT;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
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
            const cost = (log.usage?.input_tokens ?? 0) * PRICE_IN + (log.usage?.output_tokens ?? 0) * PRICE_OUT;
            return (
              <div key={idx} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{log.stage}</span>
                  <span className="text-xs text-gray-400">${cost.toFixed(4)}</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Input: {(log.usage?.input_tokens ?? 0).toLocaleString('pt-BR')} tk</span>
                  <span>Output: {(log.usage?.output_tokens ?? 0).toLocaleString('pt-BR')} tk</span>
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

function StepOrcamento({ resultado, tokenLogs, onReset }) {
  const [copied, setCopied] = useState(false);

  const copyResumo = async () => {
    const lines = [
      `ORÇAMENTO — ${resultado.meta?.nomeObra ?? 'Obra'}`,
      '',
      ...(resultado.resumo ?? []).map((r) => `${r.nome}: ${fmtBRL(r.subtotal)}`),
      '',
      `TOTAL GERAL: ${fmtBRL(resultado.meta?.totalGeral ?? 0)}`,
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const alertas = resultado.alertas ?? {};

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-xl font-semibold text-gray-800">
        Passo 5 — Orçamento — {resultado.meta?.nomeObra ?? 'Obra'}
      </h2>

      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <p className="text-sm text-blue-200 mb-1">Total Geral Estimado</p>
        <p className="text-4xl font-bold">{fmtBRL(resultado.meta?.totalGeral ?? 0)}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Por Categoria</h3>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {(resultado.resumo ?? []).filter((r) => r.subtotal > 0).sort((a, b) => b.subtotal - a.subtotal).map((r) => (
              <tr key={r.cat} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-700">{r.nome}</td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-800">{fmtBRL(r.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {alertas.semPreco?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            Itens sem preço ({alertas.semPreco.length}) — cotação necessária:
          </h3>
          <ul className="flex flex-col gap-1">
            {alertas.semPreco.map((a, i) => (
              <li key={i} className="text-xs text-amber-700">· [{a.cod}] {a.descricao} — {a.qtd} unid.</li>
            ))}
          </ul>
        </div>
      )}

      <TokenLogPanel logs={tokenLogs} />

      <div className="flex gap-3 self-end">
        <button onClick={onReset}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 active:scale-95 transition-all">
          Nova Análise
        </button>
        <button onClick={copyResumo}
          className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 active:scale-95 transition-all">
          {copied ? '✓ Copiado!' : 'Copiar Resumo'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrcamentoConstrutora() {
  const [step, setStep]               = useState(1);
  const [stems, setStems]             = useState([]);
  const [extractResults, setExtract]  = useState([]);
  const [orchResult, setOrchResult]   = useState(null);
  const [mergedData, setMerged]       = useState(null);
  const [resultado, setResultado]     = useState(null);
  const [tokenLogs, setTokenLogs]     = useState([]);
  const [restoredAt, setRestoredAt]   = useState(null);

  // Restore on mount (only serializable state)
  useEffect(() => {
    const s = loadPersisted();
    if (s) {
      if (s.step)          setStep(s.step);
      if (s.stems)         setStems(s.stems);
      if (s.extractResults)setExtract(s.extractResults);
      if (s.orchResult)    setOrchResult(s.orchResult);
      if (s.mergedData)    setMerged(s.mergedData);
      if (s.resultado)     setResultado(s.resultado);
      if (s.tokenLogs)     setTokenLogs(s.tokenLogs);
      if (s.savedAt)       setRestoredAt(s.savedAt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist (no blobs — only JSON-serializable)
  useEffect(() => {
    if (!extractResults.length && !resultado) return;
    savePersisted({ step, stems, extractResults, orchResult, mergedData, resultado, tokenLogs, savedAt: Date.now() });
  }, [step, stems, extractResults, orchResult, mergedData, resultado, tokenLogs]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUploadDone = useCallback((groups) => {
    imageStore.set(groups);
    setStems(groups.map((g) => g.stem));
    setStep(2);
  }, []);

  const handleExtractDone = useCallback((results) => {
    setExtract(results);
  }, []);

  const handleNavigateIA = useCallback((results) => {
    setExtract(results);
    setStep(3);
  }, []);

  const handleIADone = useCallback((merged, orch, logs) => {
    setMerged(merged);
    setOrchResult(orch);
    setTokenLogs((prev) => [...prev, ...logs]);
    setStep(4);
  }, []);

  const handleRevisaoDone = useCallback(async (itensRevisados) => {
    const stemName = stems[0] ?? 'Obra';
    try {
      const r = await fetch('/api/orcamento-construtora/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: itensRevisados, nomeObra: stemName }),
      });
      if (r.ok) setResultado(await r.json());
    } catch { /**/ }
    setStep(5);
  }, [stems]);

  const reset = () => {
    clearPersisted();
    imageStore.clear();
    setStep(1); setStems([]); setExtract([]); setOrchResult(null);
    setMerged(null); setResultado(null); setTokenLogs([]); setRestoredAt(null);
  };

  const accessible = useMemo(() => {
    const s = new Set([1]);
    if (stems.length > 0)       s.add(2);
    if (extractResults.length)  s.add(3);
    if (mergedData)             s.add(4);
    if (resultado)              s.add(5);
    return s;
  }, [stems.length, extractResults.length, mergedData, resultado]);

  const groups = imageStore.get();

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 py-12 px-4">
      <div className={`mx-auto transition-all ${step === 4 ? 'w-full px-4' : 'max-w-3xl'}`}>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orçamento Construtora</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Extração programática + IA em batches de 3
            </p>
          </div>
          <button onClick={reset}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border font-medium transition-all flex-shrink-0 bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
            Limpar sessão
          </button>
        </div>

        {restoredAt && (
          <div className="mb-4 flex items-center justify-between gap-3 text-xs bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
            <span className="text-blue-700">
              💾 Sessão restaurada — {new Date(restoredAt).toLocaleString('pt-BR')}
            </span>
            <button onClick={reset} className="text-blue-500 hover:text-blue-700 underline flex-shrink-0">
              Limpar
            </button>
          </div>
        )}

        <Stepper current={step} accessible={accessible} onNavigate={setStep} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === 1 && (
            <StepUpload onDone={handleUploadDone} />
          )}
          {step === 2 && (
            <StepExtract
              groups={groups.length > 0 ? groups : stems.map((s) => ({ stem: s, imageFile: null, pdfFile: null, dxfFile: null }))}
              existingResults={extractResults.length > 0 ? extractResults : null}
              onDone={handleExtractDone}
              onNavigateIA={handleNavigateIA}
            />
          )}
          {step === 3 && (
            <StepIA
              groups={groups.length > 0 ? groups : stems.map((s) => ({ stem: s, imageFile: null, pdfFile: null, dxfFile: null }))}
              extractResults={extractResults}
              existingOrchResult={orchResult}
              onDone={handleIADone}
            />
          )}
          {step === 4 && mergedData && (
            <StepReview
              mergedData={mergedData}
              imageGroups={groups}
              onDone={handleRevisaoDone}
            />
          )}
          {step === 5 && resultado && (
            <StepOrcamento resultado={resultado} tokenLogs={tokenLogs} onReset={reset} />
          )}
        </div>

      </div>
    </div>
  );
}
