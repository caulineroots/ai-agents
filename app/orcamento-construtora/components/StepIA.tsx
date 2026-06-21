'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PranchaGroup }        from '@/lib/orcamento-construtora/image-store';
import type { PranchaExtractResult, PranchaLeitura, TokenLog } from '@/hooks/useOrcamentoSession';
import type { FolhaOrcamento, ItemOrcamento, Categoria, Unidade } from '@/lib/orcamento-construtora/types';
import { mergeFolhas } from '@/lib/orcamento-construtora/merge-folhas';
import { AIDebugModal, type AIDebugEntry } from './AIDebugModal';
import {
  routeByFilename,
  GRUPO_LABELS,
  GRUPO_SECOES,
  type GrupoEspecialista,
} from '@/lib/orcamento-construtora/prancha-router';
import {
  checklistDoGrupo,
  XLSX_POR_COD,
  type XlsxItem,
} from '@/lib/orcamento-construtora/xlsx-checklist';

// ─── Tipos locais ──────────────────────────────────────────────────────────────

/** Backward compat — usado pelo onDone e pela session */
export interface OrquestradorResult {
  contexto_projeto: string;
  cliente: string;
  projeto: string;
  categorias_cobertas:    string[];
  categorias_ausentes:    string[];
  gaps_globais:           string[];
  pranchas_para_detalhar: { stem: string; motivo: string; prioridade: number; perguntas: string[] }[];
  pranchas_dispensadas:   { stem: string; motivo: string }[];
  metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
}

export interface BatchRecord {
  batch:    number;
  stems:    string[];
  batched?: Record<string, RawIAItem[]>;
  erro?:    string;
  stats?:   {
    enviado_aguardando: number;
    enviado_confirmados: number;
    retornado_novos: number;
    retornado_preenchidos: number;
    descartados_fix2: string[];
    descartados_fix3: string[];
  };
}

interface RawIAItem {
  prancha?:    string;
  id?:         number;
  ambiente?:   string;
  descricao?:  string;
  categoria?:  string;
  unidade?:    string;
  unid?:       string;
  quantidade?: number;
  qty?:        number;
  confianca?:  number;
  fonte?:      string;
  status?:     string;
  r?:          string;
  pendencias?: string[];
  cod?:        string;   // código XLSX (ex: "14.1")
}


interface GrupoResult {
  grupo:    GrupoEspecialista;
  itens:    RawIAItem[];
  stems:    string[];
  erro?:    string;
  metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = Date.now();

function mapRawItem(raw: RawIAItem): ItemOrcamento {
  const VALID_CATS = new Set<Categoria>([
    'civil','eletrica','hidraulica','marcenaria','vidros',
    'revestimento','pintura','fachada','climatizacao','outro',
  ]);
  const VALID_UNITS = new Set<Unidade>(['m2','ml','un','m3','vb','kg','hr']);

  const cat  = VALID_CATS.has(raw.categoria as Categoria) ? (raw.categoria as Categoria) : 'outro';
  const unit = VALID_UNITS.has((raw.unidade ?? raw.unid ?? '') as Unidade)
    ? ((raw.unidade ?? raw.unid) as Unidade)
    : 'un';

  return {
    id:         _idCounter++,
    status:     (raw.status as ItemOrcamento['status']) ?? 'parcial',
    ambiente:   raw.ambiente ?? 'Geral',
    descricao:  raw.descricao ?? '—',
    categoria:  cat,
    unidade:    unit,
    quantidade: raw.quantidade ?? raw.qty ?? 0,
    pendencias: raw.pendencias ?? [],
    fonte:      (raw.fonte as ItemOrcamento['fonte']) ?? 'IA',
    confianca:  raw.confianca,
    raciocinio: raw.r,
    cod:        raw.cod,
  } as ItemOrcamento & { cod?: string };
}

async function compressImageFile(file: File, maxDim = 2048, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const stem = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${stem}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Falha ao carregar ${file.name}`)); };
    img.src = url;
  });
}

/** Divide um array em lotes balanceados (distribuição uniforme, não truncagem).
 *  splitEvenly([1..13], 5) → [[1..5],[6..9],[10..13]]  (5+4+4)
 *  splitEvenly([1..12], 5) → [[1..4],[5..8],[9..12]]   (4+4+4)
 *  splitEvenly([1..5],  5) → [[1..5]]                  (sem mudança)
 */
function splitEvenly<T>(arr: T[], limit: number): T[][] {
  if (arr.length === 0) return [[]];
  const numBatches = Math.ceil(arr.length / limit);
  const base       = Math.floor(arr.length / numBatches);
  const remainder  = arr.length % numBatches;
  const batches: T[][] = [];
  let i = 0;
  for (let b = 0; b < numBatches; b++) {
    const size = base + (b < remainder ? 1 : 0);
    batches.push(arr.slice(i, i + size));
    i += size;
  }
  return batches;
}

const STATUS_RANK: Record<string, number> = { confirmado: 3, parcial: 2, aguardando: 1 };

/** Merge de resultados de sub-chamadas do mesmo grupo.
 *  Para cada cod, mantém o item com maior status; em empate, o maior qty.
 */
function mergeSubCallItems(subResults: RawIAItem[][]): RawIAItem[] {
  const best = new Map<string, RawIAItem>();
  for (const items of subResults) {
    for (const item of items) {
      const key = item.cod ?? item.descricao ?? '';
      const existing = best.get(key);
      if (!existing) { best.set(key, item); continue; }
      const rankNew = STATUS_RANK[item.status ?? '']  ?? 0;
      const rankOld = STATUS_RANK[existing.status ?? ''] ?? 0;
      if (
        rankNew > rankOld ||
        (rankNew === rankOld && (item.quantidade ?? 0) > (existing.quantidade ?? 0))
      ) {
        best.set(key, item);
      }
    }
  }
  return [...best.values()];
}


// ─── Sub-componente: card de resultado de um grupo ────────────────────────────

function GrupoCard({
  grupo, label, stems, itens, erro, metadata, onDebug, onRerun,
}: {
  grupo:    GrupoEspecialista;
  label:    string;
  stems:    string[];
  itens?:   RawIAItem[];
  erro?:    string;
  metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
  onDebug?: () => void;
  onRerun?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const confirmados = (itens ?? []).filter((it) => it.status === 'confirmado' || (it.quantidade ?? 0) > 0);
  const aguardando  = (itens ?? []).filter((it) => it.status === 'aguardando' && !(it.quantidade ?? 0));

  return (
    <div className={`border rounded-xl overflow-hidden ${erro ? 'border-red-800/60' : 'border-zinc-700'}`}>
      <button
        onClick={() => !erro && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          erro ? 'bg-red-950/30 cursor-default' : 'bg-zinc-800/50 hover:bg-zinc-700/50 cursor-pointer'
        }`}
      >
        <span className={`font-bold text-xs w-6 flex-shrink-0 ${erro ? 'text-red-400' : 'text-indigo-400'}`}>
          {erro ? '✕' : grupo}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm font-semibold text-zinc-100">{label}</span>
          <span className="text-xs text-zinc-500 ml-2">{stems.length} pranchas</span>
        </div>
        {!erro && itens && (
          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            <span className="text-green-400 font-medium">{confirmados.length} ok</span>
            {aguardando.length > 0 && (
              <span className="text-orange-400">{aguardando.length} aguardando</span>
            )}
            <span className="text-zinc-600">{open ? '▲' : '▼'}</span>
          </div>
        )}
        {onDebug && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onDebug(); }}
            className="flex-shrink-0 px-2 py-1 text-xs rounded border border-purple-700/60 bg-purple-900/30 text-purple-300 hover:bg-purple-900/60 transition-colors cursor-pointer"
            title="Ver prompt e output bruto"
          >
            🔍
          </span>
        )}
      </button>

      {erro && (
        <div className="px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-red-400 flex-1">{erro}</p>
          {onRerun && (
            <button
              onClick={onRerun}
              className="flex-shrink-0 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-semibold active:scale-95 transition-all"
            >
              ↺ Tentar novamente
            </button>
          )}
        </div>
      )}

      {open && itens && (
        <div className="px-4 py-3 flex flex-col gap-1.5 max-h-80 overflow-y-auto">
          {itens.map((it, i) => (
            <div key={i} className="flex items-start gap-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
              <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${
                it.fonte === 'PDF' ? 'bg-green-400' : 'bg-purple-400'
              }`} />
              <div className="flex-1 min-w-0">
                {it.cod && (
                  <span className="font-mono text-zinc-500 text-xs mr-1">[{it.cod}]</span>
                )}
                <span className="font-medium text-zinc-100">{it.descricao}</span>
                <span className="text-zinc-500 ml-1">
                  · {it.quantidade ?? it.qty ?? '?'} {it.unidade ?? it.unid ?? ''}
                </span>
                {it.r && (
                  <span className="ml-1 text-indigo-400 italic">「{it.r}」</span>
                )}
              </div>
              <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                it.status === 'confirmado' ? 'bg-green-900/40 text-green-400' :
                it.status === 'aguardando' ? 'bg-orange-900/40 text-orange-400' :
                'bg-purple-900/40 text-purple-400'
              }`}>{it.status ?? 'parcial'}</span>
            </div>
          ))}
        </div>
      )}

      {open && metadata && (
        <div className="px-4 pb-2 text-xs text-zinc-500 border-t border-zinc-700 pt-1.5">
          {metadata.tokens_input + metadata.tokens_output} tokens · ${metadata.custo_usd.toFixed(4)}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const GRUPOS: GrupoEspecialista[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

export function StepIA({
  groups,
  extractResults,
  existingLeituraMap,
  existingOrchResult,
  existingBatchResults,
  existingFinalFolha,
  onBatchResultsChange,
  onDone,
}: {
  groups:              PranchaGroup[];
  extractResults:      PranchaExtractResult[];
  existingLeituraMap:  PranchaLeitura[];
  existingOrchResult:  OrquestradorResult | null;
  existingBatchResults?: BatchRecord[];
  existingFinalFolha?:   FolhaOrcamento | null;
  onBatchResultsChange?: (results: BatchRecord[]) => void;
  onDone: (folha: FolhaOrcamento, orch: OrquestradorResult, leituraMap: PranchaLeitura[], logs: TokenLog[]) => void;
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [running,      setRunning]      = useState(false);
  const [progress,     setProgress]     = useState({ done: 0, total: 0 });
  const [grupoResults, setGrupoResults] = useState<GrupoResult[]>([]);
  const [allDone,      setAllDone]      = useState(false);

  const [finalFolha,   setFinalFolha]   = useState<FolhaOrcamento | null>(existingFinalFolha ?? null);
  const [tokenLogs,    setTokenLogs]    = useState<TokenLog[]>([]);
  const [erro,         setErro]         = useState('');
  const runRef = useRef(false);

  const [debugEntries,    setDebugEntries]    = useState<AIDebugEntry[]>([]);
  const [showDebug,       setShowDebug]       = useState(false);
  const [debugInitialIdx, setDebugInitialIdx] = useState<number | undefined>(undefined);

  const openDebug = useCallback((idx?: number) => {
    setDebugInitialIdx(idx);
    setShowDebug(true);
  }, []);

  const addLog = useCallback((stage: string, meta: { tokens_input?: number; tokens_output?: number }) => {
    setTokenLogs((prev) => [...prev, {
      stage,
      usage: { input_tokens: meta.tokens_input ?? 0, output_tokens: meta.tokens_output ?? 0 },
    }]);
  }, []);

  // Sync batch results for session persistence
  useEffect(() => {
    if (grupoResults.length === 0) return;
    // Encode group results into BatchRecord shape for session compat
    const batchRecords: BatchRecord[] = grupoResults.map((gr, i) => ({
      batch:    i + 1,
      stems:    gr.stems,
      batched:  { [gr.grupo]: gr.itens },
      erro:     gr.erro,
    }));
    onBatchResultsChange?.(batchRecords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoResults]);

  // ── Derived: route stems to groups ────────────────────────────────────────
  const stems = groups.map((g) => g.stem);
  const grupoPorStems = routeByFilename(stems);

  // ── Run all 6 specialist groups ───────────────────────────────────────────

  const runEspecialistas = useCallback(async () => {
    if (runRef.current) return;
    if (groups.length === 0) {
      setErro('Nenhuma prancha disponível. Execute o Passo 2 antes.');
      return;
    }

    runRef.current = true;
    setRunning(true);
    setGrupoResults([]);
    setAllDone(false);
    setFinalFolha(null);
    setErro('');
    // Calcula total de etapas (soma dos lotes balanceados de cada grupo)
    const MAX_IMAGES = 5;
    const totalSteps = GRUPOS.reduce((sum, g) => {
      const n = (grupoPorStems[g] ?? []).length;
      return sum + (n === 0 ? 1 : Math.ceil(n / MAX_IMAGES));
    }, 0);
    setProgress({ done: 0, total: totalSteps });

    try {
      const allItems: Record<string, RawIAItem[]> = {};

      for (const grupo of GRUPOS) {
        const grupoStems = grupoPorStems[grupo] ?? [];
        const checklist  = checklistDoGrupo(grupo);
        const secoes     = GRUPO_SECOES[grupo];

        // Coleta imagens e tabelas PDF de todas as pranchas do grupo
        const allImages:    { stem: string; file: File }[] = [];
        const allPdfTables: { stem: string; itens: object[] }[] = [];

        for (const stem of grupoStems) {
          const g  = groups.find((g) => g.stem === stem);
          const er = extractResults.find((r) => r.stem === stem);
          if (g?.imageFile) allImages.push({ stem, file: g.imageFile });
          if (er?.itens_extraidos?.length) {
            allPdfTables.push({ stem, itens: er.itens_extraidos });
          }
        }

        // Divide em lotes balanceados (ex: 13 imagens → 5+4+4)
        const batches    = splitEvenly(allImages, MAX_IMAGES);
        const numBatches = batches.length;
        const subResults: RawIAItem[][] = [];
        let   mergedMeta = { tokens_input: 0, tokens_output: 0, custo_usd: 0 };
        let   grupoErro  = '';

        for (let bi = 0; bi < numBatches; bi++) {
          const batch      = batches[bi];
          const batchStems = new Set(batch.map((b) => b.stem));

          // Tabelas QNT apenas das pranchas deste lote
          const batchPdfTables = allPdfTables.filter((t) => batchStems.has(t.stem));

          const fd = new FormData();
          for (let i = 0; i < batch.length; i++) {
            const compressed = await compressImageFile(batch[i].file);
            fd.append(`image_${i}`, compressed, compressed.name);
          }
          fd.append('context_json', JSON.stringify({
            grupo,
            secoes,
            sub_chamada: numBatches > 1 ? `${bi + 1}/${numBatches}` : undefined,
            checklist: checklist.map((it: XlsxItem) => ({
              cod:             it.cod,
              descricao:       it.descricao,
              unidade:         it.unidade,
              zona:            it.zona,
              vlrUnit:         it.vlrUnit,
              materialCliente: it.materialCliente,
              qdeReferencia:   it.qdeReferencia,
              zerado:          it.zerado ?? false,
            })),
            pdf_tables: batchPdfTables,
          }));

          const debugLabel = numBatches > 1
            ? `Especialista ${grupo} (${bi + 1}/${numBatches}) — ${GRUPO_LABELS[grupo]}`
            : `Especialista ${grupo} — ${GRUPO_LABELS[grupo]}`;

          try {
            const r = await fetch('/api/orcamento-construtora/especialista', {
              method: 'POST',
              body: fd,
            });
            const data = await r.json() as {
              itens?: RawIAItem[];
              metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
              prompt_sent?: string;
              raw_output?: string;
              error?: string;
            };

            setDebugEntries((prev) => [...prev, {
              label:  debugLabel,
              prompt: data.prompt_sent ?? '(não disponível)',
              output: data.raw_output  ?? '(não disponível)',
            }]);

            if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);

            if (data.metadata) {
              mergedMeta.tokens_input  += data.metadata.tokens_input;
              mergedMeta.tokens_output += data.metadata.tokens_output;
              mergedMeta.custo_usd     += data.metadata.custo_usd;
            }
            addLog(debugLabel, data.metadata ?? {});
            subResults.push(data.itens ?? []);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            grupoErro = (grupoErro ? grupoErro + '\n' : '') + `${debugLabel}: ${msg}`;
            setErro((prev) => (prev ? prev + '\n' : '') + `${debugLabel}: ${msg}`);
            subResults.push([]);
          }

          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }

        // Merge dos resultados de todos os lotes por prioridade de status
        const itens = mergeSubCallItems(subResults);
        allItems[grupo] = itens;

        const grupoResult: GrupoResult = grupoErro && itens.length === 0
          ? { grupo, itens: [], stems: grupoStems, erro: grupoErro }
          : { grupo, itens, stems: grupoStems, metadata: mergedMeta };

        setGrupoResults((prev) => [...prev, grupoResult]);
      }

      // ── Montar FolhaOrcamento a partir dos resultados dos grupos ──────────
      // Todos os itens do checklist respondidos pelos especialistas, desduplicados
      const seenCods  = new Set<string>();
      const allMapped: ItemOrcamento[] = [];

      for (const grupo of GRUPOS) {
        for (const raw of (allItems[grupo] ?? [])) {
          const cod = raw.cod;
          if (cod && seenCods.has(cod)) continue; // dedup por cod XLSX
          if (cod) seenCods.add(cod);
          // Enrich with XLSX data
          const xlsxItem = cod ? XLSX_POR_COD[cod] : undefined;
          allMapped.push(mapRawItem({
            ...raw,
            categoria: raw.categoria ?? xlsxItem?.secao as unknown as string ?? 'outro',
          }));
        }
      }

      const folha: FolhaOrcamento = mergeFolhas([{
        projeto: 'fit-out',
        cliente: 'C&A',
        itens:   allMapped,
      }]);
      setFinalFolha(folha);
      setAllDone(true);
    } finally {
      setRunning(false);
      runRef.current = false;
    }
  }, [groups, extractResults, grupoPorStems, addLog]);

  // ── Re-run a single failed grupo ─────────────────────────────────────────

  const runSingleGrupo = useCallback(async (grupo: GrupoEspecialista) => {
    if (runRef.current) return;
    runRef.current = true;
    setErro('');

    const grupoStems = grupoPorStems[grupo] ?? [];
    const checklist  = checklistDoGrupo(grupo);
    const secoes     = GRUPO_SECOES[grupo];
    const MAX_IMAGES = 5;

    const allImages:    { stem: string; file: File }[] = [];
    const allPdfTables: { stem: string; itens: object[] }[] = [];

    for (const stem of grupoStems) {
      const g  = groups.find((g) => g.stem === stem);
      const er = extractResults.find((r) => r.stem === stem);
      if (g?.imageFile) allImages.push({ stem, file: g.imageFile });
      if (er?.itens_extraidos?.length) allPdfTables.push({ stem, itens: er.itens_extraidos });
    }

    const batches    = splitEvenly(allImages, MAX_IMAGES);
    const numBatches = batches.length;
    const subResults: RawIAItem[][] = [];
    let   mergedMeta = { tokens_input: 0, tokens_output: 0, custo_usd: 0 };
    let   grupoErro  = '';

    for (let bi = 0; bi < numBatches; bi++) {
      const batch      = batches[bi];
      const batchStems = new Set(batch.map((b) => b.stem));
      const batchPdfTables = allPdfTables.filter((t) => batchStems.has(t.stem));

      const fd = new FormData();
      for (let i = 0; i < batch.length; i++) {
        const compressed = await compressImageFile(batch[i].file);
        fd.append(`image_${i}`, compressed, compressed.name);
      }
      fd.append('context_json', JSON.stringify({
        grupo, secoes,
        sub_chamada: numBatches > 1 ? `${bi + 1}/${numBatches}` : undefined,
        checklist: checklist.map((it: XlsxItem) => ({
          cod: it.cod, descricao: it.descricao, unidade: it.unidade,
          zona: it.zona, vlrUnit: it.vlrUnit, materialCliente: it.materialCliente,
          qdeReferencia: it.qdeReferencia, zerado: it.zerado ?? false,
        })),
        pdf_tables: batchPdfTables,
      }));

      const debugLabel = numBatches > 1
        ? `Especialista ${grupo} (${bi + 1}/${numBatches}) — ${GRUPO_LABELS[grupo]}`
        : `Especialista ${grupo} — ${GRUPO_LABELS[grupo]}`;

      try {
        const r = await fetch('/api/orcamento-construtora/especialista', { method: 'POST', body: fd });
        const data = await r.json() as {
          itens?: RawIAItem[];
          metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
          prompt_sent?: string; raw_output?: string; error?: string;
        };
        setDebugEntries((prev) => [...prev, {
          label: debugLabel,
          prompt: data.prompt_sent ?? '(não disponível)',
          output: data.raw_output  ?? '(não disponível)',
        }]);
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        if (data.metadata) {
          mergedMeta.tokens_input  += data.metadata.tokens_input;
          mergedMeta.tokens_output += data.metadata.tokens_output;
          mergedMeta.custo_usd     += data.metadata.custo_usd;
        }
        addLog(debugLabel, data.metadata ?? {});
        subResults.push(data.itens ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        grupoErro = (grupoErro ? grupoErro + '\n' : '') + `${debugLabel}: ${msg}`;
        setErro(msg);
        subResults.push([]);
      }
    }

    const itens = mergeSubCallItems(subResults);
    const newGrupoResult: GrupoResult = grupoErro && itens.length === 0
      ? { grupo, itens: [], stems: grupoStems, erro: grupoErro }
      : { grupo, itens, stems: grupoStems, metadata: mergedMeta };

    // Replace this grupo's result and rebuild the folha
    setGrupoResults((prev) => {
      const updated = prev.map((gr) => gr.grupo === grupo ? newGrupoResult : gr);

      // Rebuild FolhaOrcamento from all updated results
      const seenCods  = new Set<string>();
      const allMapped: ItemOrcamento[] = [];
      for (const g of GRUPOS) {
        const gr = updated.find((r) => r.grupo === g);
        for (const raw of (gr?.itens ?? [])) {
          const cod = raw.cod;
          if (cod && seenCods.has(cod)) continue;
          if (cod) seenCods.add(cod);
          const xlsxItem = cod ? XLSX_POR_COD[cod] : undefined;
          allMapped.push(mapRawItem({
            ...raw,
            categoria: raw.categoria ?? xlsxItem?.secao as unknown as string ?? 'outro',
          }));
        }
      }
      const folha = mergeFolhas([{ projeto: 'fit-out', cliente: 'C&A', itens: allMapped }]);
      setFinalFolha(folha);

      return updated;
    });

    runRef.current = false;
  }, [groups, extractResults, grupoPorStems, addLog]);

  // ── Proceed to review ─────────────────────────────────────────────────────

  const handleDone = useCallback(() => {
    if (!finalFolha) return;
    const orchCompat: OrquestradorResult = {
      contexto_projeto:       'Projeto analisado por 6 especialistas de IA.',
      cliente:                'C&A',
      projeto:                'fit-out',
      categorias_cobertas:    GRUPOS.map((g) => GRUPO_LABELS[g]),
      categorias_ausentes:    [],
      gaps_globais:           [],
      pranchas_para_detalhar: [],
      pranchas_dispensadas:   [],
    };
    onDone(finalFolha, orchCompat, [] as PranchaLeitura[], tokenLogs);
  }, [finalFolha, tokenLogs, onDone]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalTokens = tokenLogs.reduce((s, l) => s + l.usage.input_tokens + l.usage.output_tokens, 0);
  const totalCusto  = tokenLogs.reduce(
    (s, l) => s + l.usage.input_tokens * 3 / 1_000_000 + l.usage.output_tokens * 15 / 1_000_000, 0,
  );

  const totalItems   = grupoResults.reduce((s, gr) => s + gr.itens.length, 0);
  const totalOk      = grupoResults.reduce(
    (s, gr) => s + gr.itens.filter((it) => it.status === 'confirmado' || (it.quantidade ?? 0) > 0).length, 0
  );
  const totalAguard  = totalItems - totalOk;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {showDebug && debugEntries.length > 0 && (
        <AIDebugModal
          entries={debugEntries}
          initialIndex={debugInitialIdx}
          onClose={() => setShowDebug(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Passo 3 — Análise com IA</h2>
          <p className="text-sm text-zinc-500 mt-1">
            6 especialistas com checklist do XLSX. Itens não encontrados ficam aguardando revisão.
          </p>
        </div>
        {debugEntries.length > 0 && (
          <button
            onClick={() => openDebug()}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-700/60 bg-purple-900/30 text-purple-300 hover:bg-purple-900/60 transition-colors"
          >
            <span>🔍</span>
            Debug IA
            <span className="ml-1 px-1.5 py-0.5 bg-purple-800 text-purple-200 rounded-full text-xs font-bold">
              {debugEntries.length}
            </span>
          </button>
        )}
      </div>

      {/* ─── Roteamento (sempre visível, sem chamada de API) ─────────────────── */}
      <div className="border border-zinc-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-zinc-800/60 flex items-center gap-3">
          <span className="w-5 h-5 rounded-full border-2 border-zinc-600 inline-flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">0</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-200">Roteamento de Pranchas</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {stems.length} pranchas roteadas para 6 grupos por nome de arquivo (0 chamadas de IA)
            </p>
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-2 bg-zinc-900/50">
          {GRUPOS.map((grupo) => {
            const stemsG = grupoPorStems[grupo] ?? [];
            return (
              <div key={grupo} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-mono font-bold text-indigo-400">{grupo}</span>
                  <span className="text-zinc-400">{GRUPO_LABELS[grupo]}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {stemsG.length > 0
                    ? stemsG.map((s) => (
                        <span key={s} className="text-zinc-400 font-mono truncate">
                          {s.split('-').slice(-1)[0]}
                        </span>
                      ))
                    : <span className="text-zinc-600 italic">nenhuma</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Especialistas + Auditoria ────────────────────────────────────────── */}
      <div className={`border rounded-xl overflow-hidden ${
        allDone ? 'border-green-700/60' : running ? 'border-blue-700/60' : 'border-zinc-700'
      }`}>
        <div className={`px-4 py-3 flex items-center gap-3 ${
          allDone ? 'bg-green-950/40' : running ? 'bg-blue-950/40' : 'bg-zinc-800/60'
        }`}>
          {allDone
            ? <span className="text-green-400 font-bold text-sm flex-shrink-0">✓</span>
            : running
            ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <span className="w-5 h-5 rounded-full border-2 border-zinc-600 inline-flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">1</span>
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${allDone ? 'text-green-300' : running ? 'text-blue-300' : 'text-zinc-200'}`}>
              Análise por Especialistas (G1–G6)
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {running
                ? `Especialista ${progress.done + 1}/${progress.total} em andamento…`
                : allDone
                ? `${totalItems} itens · ${totalOk} confirmados · ${totalAguard} aguardando`
                : `6 chamadas de IA com checklist XLSX + tabelas QNT extraídas do PDF`}
            </p>
          </div>
          {!allDone && !running && (
            <button
              onClick={runEspecialistas}
              disabled={groups.length === 0}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Analisar →
            </button>
          )}
          {allDone && !running && (
            <button
              onClick={() => {
                setGrupoResults([]);
                setAllDone(false);
                setFinalFolha(null);
                setErro('');
                runEspecialistas();
              }}
              className="flex-shrink-0 px-3 py-1.5 border border-zinc-600 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 transition-all"
            >
              ↺ Re-executar
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(running || grupoResults.length > 0) && progress.total > 0 && (
          <div className="px-4 pt-3">
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">{progress.done}/{progress.total} grupos concluídos</p>
          </div>
        )}

        {/* Group results */}
        {grupoResults.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2">
            {grupoResults.map((gr) => {
              const idx = debugEntries.findIndex(
                (e) => e.label === `Especialista ${gr.grupo} — ${GRUPO_LABELS[gr.grupo]}`
              );
              return (
                <GrupoCard
                  key={gr.grupo}
                  grupo={gr.grupo}
                  label={GRUPO_LABELS[gr.grupo]}
                  stems={gr.stems}
                  itens={gr.itens}
                  erro={gr.erro}
                  metadata={gr.metadata}
                  onDebug={idx >= 0 ? () => openDebug(idx) : undefined}
                  onRerun={gr.erro ? () => runSingleGrupo(gr.grupo) : undefined}
                />
              );
            })}
          </div>
        )}

        {tokenLogs.length > 0 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-zinc-500">
              {totalTokens.toLocaleString('pt-BR')} tokens · ${totalCusto.toFixed(4)} USD
            </p>
          </div>
        )}
      </div>

      {/* ─── Revisão de Pendências ─────────────────────────────────────────────── */}
      {allDone && (() => {
        // Collect all aguardando items grouped by section
        const pendMap = new Map<string, { cod: string; descricao: string; r?: string }[]>();
        for (const gr of grupoResults) {
          for (const it of gr.itens) {
            if (it.status !== 'aguardando') continue;
            const xlsxItem = it.cod ? XLSX_POR_COD[it.cod] : undefined;
            const secao = xlsxItem ? String(xlsxItem.secao) : '?';
            if (!pendMap.has(secao)) pendMap.set(secao, []);
            pendMap.get(secao)!.push({ cod: it.cod ?? '', descricao: it.descricao ?? '', r: it.r });
          }
        }
        const totalPend = [...pendMap.values()].reduce((s, v) => s + v.length, 0);
        const secoes = [...pendMap.entries()].sort(([a], [b]) => {
          const na = parseFloat(a); const nb = parseFloat(b);
          return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
        });

        return (
          <div className={`border rounded-xl overflow-hidden ${totalPend > 0 ? 'border-amber-700/60' : 'border-green-700/60'}`}>
            <div className={`px-4 py-3 flex items-center gap-3 ${totalPend > 0 ? 'bg-amber-950/30' : 'bg-green-950/30'}`}>
              <span className={`font-bold text-sm flex-shrink-0 ${totalPend > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {totalPend > 0 ? '⚠' : '✓'}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${totalPend > 0 ? 'text-amber-300' : 'text-green-300'}`}>
                  Revisão de Pendências
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {totalPend > 0
                    ? `${totalPend} ${totalPend === 1 ? 'item aguardando' : 'itens aguardando'} quantificação manual`
                    : 'Todos os itens foram quantificados'}
                </p>
              </div>
            </div>

            {totalPend > 0 && (
              <div className="px-4 py-3 border-t border-zinc-700 flex flex-col gap-3">
                {secoes.map(([secao, itens]) => (
                  <div key={secao}>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                      Seção {secao} — {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                    </p>
                    <div className="flex flex-col gap-1">
                      {itens.map((it) => (
                        <div key={it.cod} className="bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2 text-xs">
                          <span className="font-mono text-amber-400 mr-2">[{it.cod}]</span>
                          <span className="text-zinc-300">{it.descricao}</span>
                          {it.r && (
                            <span className="ml-2 text-zinc-500 italic">— {it.r}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-3 bg-red-950/30 border border-red-800/60 rounded-lg px-4 py-3">
          <pre className="text-xs text-red-400 whitespace-pre-wrap break-all flex-1">
            {erro}
          </pre>
        </div>
      )}

      {/* CTA */}
      {finalFolha && (
        <div className="flex items-center justify-between gap-4 bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3">
          <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
            <span>{totalTokens.toLocaleString('pt-BR')} tokens</span>
            <span className="font-semibold text-zinc-200">${totalCusto.toFixed(4)} USD</span>
            <span>{finalFolha.itens.length} itens identificados</span>
            {totalAguard > 0 && (
              <span className="text-amber-400">
                {totalAguard} aguardando revisão
              </span>
            )}
          </div>
          <button
            onClick={handleDone}
            className="flex-shrink-0 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all"
          >
            Ver Revisão →
          </button>
        </div>
      )}
    </div>
  );
}

