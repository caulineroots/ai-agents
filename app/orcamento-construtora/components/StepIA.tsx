'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PranchaGroup }        from '@/lib/orcamento-construtora/image-store';
import type { PranchaExtractResult, PranchaLeitura, TokenLog } from '@/hooks/useOrcamentoSession';
import type { FolhaOrcamento, ItemOrcamento, Categoria, Unidade, IaReconcileResult } from '@/lib/orcamento-construtora/types';
import { mergeFolhas } from '@/lib/orcamento-construtora/merge-folhas';
import { AIDebugModal, type AIDebugEntry } from './AIDebugModal';
import {
  routeByFilename,
  GRUPO_LABELS,
  type GrupoEspecialista,
} from '@/lib/orcamento-construtora/prancha-router';
import {
  XLSX_ITENS,
  XLSX_POR_COD,
  type XlsxItem,
} from '@/lib/orcamento-construtora/xlsx-checklist-bln';
import { categoriaFromGrupo } from '@/lib/orcamento-construtora/grupo-categoria';

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

// ─── Filtro de tabelas orçamentáveis ─────────────────────────────────────────

const TABELAS_ORCAMENTO = /^(PAREDES|PINTURA|FORROS|PISOS|RODAPES|SOLEIRAS|TAPUMES|CERÂMICA|CERAMICA|RFID_|QNT_|LINEAR_|QNTD_|QUADRO|GERAL)/i;
const RE_PORTA = /^(PA|PD|PM|PF|PV)\s*\d/i;

function isOrcamentoItem(it: { tabela?: string; descricao?: string }): boolean {
  const tab = it.tabela ?? '';
  if (!tab || tab.toUpperCase() === 'GLOBAL_SCAN') return false;
  if (TABELAS_ORCAMENTO.test(tab)) return true;
  return RE_PORTA.test(it.descricao ?? '');
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

// ─── Helpers ──────────────────────────────────────────────────────────────────


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
  const confirmados = (itens ?? []).filter((it) => (it.quantidade ?? 0) > 0);

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
            <span className="text-green-400 font-medium">{confirmados.length} encontrados</span>
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
  // ── Types ─────────────────────────────────────────────────────────────────
  interface VerificacaoResult {
    qualidade_extracao: 'boa' | 'parcial' | 'insuficiente';
    observacoes: string[];
    categorias_possivelmente_ausentes: string[];
    itens_provavelmente_em_tabela: string[];
    metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
  }

  interface OrcarItem {
    cod:             string;
    descricao:       string;
    quantidade:      number;
    unidade:         string;
    vlrUnit:         number;
    vlrTotal:        number;
    mat?:            number;
    mo?:             number;
    vlrMat?:         number;
    vlrMo?:          number;
    materialCliente?: boolean;
    qdeReferencia?:  number | null;
    confianca:       number;
    fonte_pranchas:  string[];
    status:          string;
  }

  interface OrcarResidual {
    cod:      string;
    descricao:string;
    unidade:  string;
  }

  interface OrcarResponse {
    itens:      OrcarItem[];
    residual:   OrcarResidual[];
    dedup_log:  { tabela: string; kept: string | null; dropped: string[]; gt: number | null }[];
    linhas_pre_agregacao?: Array<{
      cod?: string; descricao: string; quantidade: number; unidade: string;
      tabela?: string; fonte_pranchas?: string[];
    }>;
    metadata:   { n_itens_entrada: number; n_apos_dedup: number; n_mapeados: number; n_residual: number };
  }

  interface AuditarResponse extends IaReconcileResult {
    error?: string;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const [running,      setRunning]      = useState(false);
  const [progress,     setProgress]     = useState({ done: 0, total: 0 });
  const [grupoResults, setGrupoResults] = useState<GrupoResult[]>([]);
  const [allDone,      setAllDone]      = useState(false);
  const [orcarResult,  setOrcarResult]  = useState<OrcarResponse | null>(null);
  const [incluirSecaoA, setIncluirSecaoA] = useState(false);
  const [incluirAuditoriaHaiku, setIncluirAuditoriaHaiku] = useState(true);

  const [verificacao,  setVerificacao]  = useState<VerificacaoResult | null>(null);
  const [verificando,  setVerificando]  = useState(false);

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

  // ── Run deterministic pipeline ───────────────────────────────────────────

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
    setVerificacao(null);
    setOrcarResult(null);
    setErro('');

    // Infere o nome da obra a partir dos stems (ex: "CEA-254-BLN-ARQ_R03-301" → "CEA-254-BLN")
    const obraMatch = stems.map((s) => s.match(/^(CEA-\d+-[A-Z]+)/i)).find(Boolean);
    const obraId    = obraMatch?.[1] ?? stems[0]?.split('-').slice(0, 3).join('-') ?? 'obra';

    setProgress({ done: 0, total: 1 });

    try {
      // ── Pipeline determinístico: 1 chamada para todas as pranchas ─────────
      const allPranchas = extractResults.map((er) => ({
        stem:  er.stem,
        items: (er.itens_extraidos ?? []).filter(isOrcamentoItem),
      })).filter((p) => p.items.length > 0);

      // Checklist completo (todos os grupos)
      const fullChecklist = XLSX_ITENS.map((it: XlsxItem) => ({
        cod:             it.cod,
        descricao:       it.descricao,
        unidade:         it.unidade,
        zona:            it.zona,
        secao:           it.secao,
        mat:             it.mat,
        mo:              it.mo,
        vlrUnit:         it.vlrUnit,
        materialCliente: it.materialCliente,
        qdeReferencia:   it.qdeReferencia,
        zerado:          it.zerado ?? false,
      }));

      const fd = new FormData();
      fd.append('context_json', JSON.stringify({
        obra:            obraId,
        checklist:       fullChecklist,
        pranchas:        allPranchas,
        incluir_secao_a: incluirSecaoA,
      }));

      let orcarData: OrcarResponse | null = null;
      let iaReconcile: IaReconcileResult | undefined;

      try {
        const r    = await fetch('/api/orcamento-construtora/orcar', { method: 'POST', body: fd });
        const data = await r.json() as OrcarResponse & { error?: string };
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        orcarData = data;
        setOrcarResult(data);
        addLog('Pipeline Determinístico', { tokens_input: 0, tokens_output: 0 });

        if (incluirAuditoriaHaiku && data.itens.length > 0) {
          try {
            const auditFd = new FormData();
            auditFd.append('context_json', JSON.stringify({
              obra:                   obraId,
              checklist:              fullChecklist,
              itens_deterministicos:  data.itens,
              dedup_log:              data.dedup_log,
              linhas_pre_agregacao:   data.linhas_pre_agregacao ?? [],
            }));
            const ar = await fetch('/api/orcamento-construtora/orcar-auditar', { method: 'POST', body: auditFd });
            const auditData = await ar.json() as AuditarResponse;
            if (!ar.ok) throw new Error(auditData.error ?? `HTTP ${ar.status}`);
            iaReconcile = {
              duplicatas:    auditData.duplicatas ?? [],
              cods_revisados: auditData.cods_revisados ?? [],
              observacoes:   auditData.observacoes ?? [],
              metadata:      auditData.metadata,
            };
            addLog('Auditoria Haiku (dedup)', {
              tokens_input:  auditData.metadata?.tokens_input ?? 0,
              tokens_output: auditData.metadata?.tokens_output ?? 0,
            });
          } catch (ae) {
            const msg = ae instanceof Error ? ae.message : String(ae);
            console.warn('[orcar-auditar]', msg);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErro(`Pipeline determinístico falhou: ${msg}`);
      }

      setProgress({ done: 1, total: 1 });

      // ── Synthetic grupo results for backward compat ───────────────────────
      if (orcarData) {
        const syntheticByGrupo: Record<string, RawIAItem[]> = {};
        for (const it of orcarData.itens) {
          const xlsxItem = XLSX_POR_COD[it.cod];
          const grupo    = (xlsxItem as unknown as { grupo?: string })?.grupo ?? 'G1';
          if (!syntheticByGrupo[grupo]) syntheticByGrupo[grupo] = [];
          syntheticByGrupo[grupo].push({
            cod:        it.cod,
            descricao:  it.descricao,
            quantidade: it.quantidade,
            unidade:    it.unidade as RawIAItem['unidade'],
            fonte:      'PDF',
            status:     'confirmado',
            confianca:  it.confianca,
          });
        }
        const syntheticResults: GrupoResult[] = GRUPOS.map((g) => ({
          grupo: g,
          itens: syntheticByGrupo[g] ?? [],
          stems: grupoPorStems[g] ?? [],
        }));
        setGrupoResults(syntheticResults);
      }

      // ── Montar FolhaOrcamento a partir dos itens determinísticos ──────────
      const sugestaoPorCod = new Map(
        (iaReconcile?.cods_revisados ?? []).map((c) => [c.cod, c]),
      );

      const allMapped: ItemOrcamento[] = (orcarData?.itens ?? []).map((it) => {
        const xlsxItem = XLSX_POR_COD[it.cod];
        const sug = sugestaoPorCod.get(it.cod);
        const base = mapRawItem({
          cod:        it.cod,
          descricao:  it.descricao,
          quantidade: it.quantidade,
          unidade:    it.unidade as RawIAItem['unidade'],
          fonte:      it.status === 'planilha' ? 'PDF' : 'PDF',
          status:     it.status === 'planilha' ? 'confirmado' : 'confirmado',
          confianca:  it.confianca,
          categoria:  categoriaFromGrupo(xlsxItem?.grupo, it.descricao),
        });
        if (sug && sug.qty_sugerida > 0) {
          (base as ItemOrcamento).iaSugestao = {
            qty:       sug.qty_sugerida,
            motivo:    sug.motivo,
            confianca: sug.confianca,
          };
        }
        (base as ItemOrcamento).cod = it.cod;
        return base as ItemOrcamento;
      });

      const folha: FolhaOrcamento = mergeFolhas([{
        projeto: 'fit-out',
        cliente: 'C&A',
        itens:   allMapped,
        orcarMeta: orcarData ? {
          residual:              orcarData.residual,
          dedup_log:             orcarData.dedup_log,
          iaReconcile,
          linhas_pre_agregacao:  orcarData.linhas_pre_agregacao,
        } : undefined,
      }]);
      setFinalFolha(folha);
      setAllDone(true);

      // Verificação simplificada: sem aguardando no pipeline determinístico
      // (mantida apenas para compatibilidade — não envia chamada de IA desnecessária)
    } finally {
      setRunning(false);
      runRef.current = false;
    }
  }, [groups, extractResults, grupoPorStems, addLog, incluirSecaoA, incluirAuditoriaHaiku]);

  // ── Re-run pipeline (replaces single-grupo re-run) ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const runSingleGrupo = useCallback((_grupo: GrupoEspecialista) => {
    // Pipeline determinístico: re-roda o fluxo completo
    runEspecialistas();
  }, [runEspecialistas]);

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

  const totalOk = grupoResults.reduce(
    (s, gr) => s + gr.itens.filter((it) => (it.quantidade ?? 0) > 0).length, 0
  );

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
          <h2 className="text-xl font-semibold text-white">Passo 3 — Mapeamento XLSX</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Pipeline determinístico: deduplica tabelas repetidas entre pranchas e mapeia para o checklist XLSX. Apenas itens encontrados aparecem.
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

      {/* Toggle Seção A + Auditoria Haiku */}
      {!allDone && !running && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800/40 border border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-800/60 transition-colors">
            <input
              type="checkbox"
              checked={incluirSecaoA}
              onChange={(e) => setIncluirSecaoA(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
            />
            <div>
              <p className="text-sm font-medium text-zinc-200">Incluir custos indiretos (Seção A) da planilha Celmar</p>
              <p className="text-xs text-zinc-500 mt-0.5">ART, seguro, engenheiro residente etc. — quantidades da coluna qdeReferencia</p>
            </div>
          </label>
          <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800/40 border border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-800/60 transition-colors">
            <input
              type="checkbox"
              checked={incluirAuditoriaHaiku}
              onChange={(e) => setIncluirAuditoriaHaiku(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500"
            />
            <div>
              <p className="text-sm font-medium text-zinc-200">Incluir auditoria Haiku (duplicatas)</p>
              <p className="text-xs text-zinc-500 mt-0.5">Sugere quantidades alternativas no Passo 5 — você decide no card</p>
            </div>
          </label>
        </div>
      )}

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
              Pipeline Determinístico
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {running
                ? 'Dedup + mapeamento XLSX em andamento…'
                : allDone && orcarResult
                ? `${orcarResult.metadata.n_mapeados} itens mapeados · ${orcarResult.metadata.n_apos_dedup}/${orcarResult.metadata.n_itens_entrada} após dedup · ${orcarResult.metadata.n_residual} residual`
                : allDone
                ? `${totalOk} itens encontrados`
                : '1 chamada determinística — dedup + MAPA_FIXO + Haiku fallback'}
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


      {/* ─── Verificação de Completude ────────────────────────────────────── */}
      {(verificando || verificacao) && (
        <div className={`border rounded-xl overflow-hidden ${
          verificando ? 'border-zinc-600' :
          verificacao?.qualidade_extracao === 'boa' ? 'border-green-700/60' :
          verificacao?.qualidade_extracao === 'insuficiente' ? 'border-red-700/60' :
          'border-blue-700/60'
        }`}>
          <div className={`px-4 py-3 flex items-center gap-3 ${
            verificando ? 'bg-zinc-800/60' :
            verificacao?.qualidade_extracao === 'boa' ? 'bg-green-950/30' :
            verificacao?.qualidade_extracao === 'insuficiente' ? 'bg-red-950/30' :
            'bg-blue-950/30'
          }`}>
            {verificando
              ? <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              : <span className={`font-bold text-sm flex-shrink-0 ${
                  verificacao?.qualidade_extracao === 'boa' ? 'text-green-400' :
                  verificacao?.qualidade_extracao === 'insuficiente' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {verificacao?.qualidade_extracao === 'boa' ? '✓' : verificacao?.qualidade_extracao === 'insuficiente' ? '✕' : '⚠'}
                </span>
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                verificando ? 'text-zinc-300' :
                verificacao?.qualidade_extracao === 'boa' ? 'text-green-300' :
                verificacao?.qualidade_extracao === 'insuficiente' ? 'text-red-300' : 'text-blue-300'
              }`}>
                Verificação de Completude
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {verificando
                  ? 'Haiku verificando se todas as tabelas foram capturadas…'
                  : `Qualidade: ${verificacao?.qualidade_extracao ?? '—'}`}
              </p>
            </div>
            {verificacao?.metadata && (
              <span className="text-xs text-zinc-600 flex-shrink-0">
                {verificacao.metadata.tokens_input + verificacao.metadata.tokens_output} tokens
              </span>
            )}
          </div>

          {verificacao && (verificacao.observacoes.length > 0 || verificacao.categorias_possivelmente_ausentes.length > 0) && (
            <div className="px-4 py-3 border-t border-zinc-700 flex flex-col gap-3">
              {verificacao.observacoes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Observações</p>
                  <div className="flex flex-col gap-1">
                    {verificacao.observacoes.map((obs, i) => (
                      <div key={i} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300">
                        {obs}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {verificacao.categorias_possivelmente_ausentes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Categorias possivelmente ausentes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {verificacao.categorias_possivelmente_ausentes.map((cat) => (
                      <span key={cat} className="px-2 py-0.5 bg-amber-950/30 border border-amber-700/40 rounded text-xs text-amber-300 font-mono">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Itens residuais (sem cobertura determinística) ─────────────────── */}
      {orcarResult && orcarResult.residual.length > 0 && (
        <div className="border border-amber-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-950/30 flex items-center gap-3">
            <span className="text-amber-400 font-bold text-sm flex-shrink-0">⚠</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300">
                Itens sem cobertura — revisar manualmente
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {orcarResult.residual.length} itens do checklist não foram encontrados nas tabelas PDF.
                Preencha as quantidades na planilha final.
              </p>
            </div>
          </div>
          <div className="px-4 py-2 max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-700">
                  <th className="text-left py-1 pr-3 font-medium">Cód</th>
                  <th className="text-left py-1 font-medium">Descrição</th>
                  <th className="text-right py-1 pl-3 font-medium">Un</th>
                </tr>
              </thead>
              <tbody>
                {orcarResult.residual.map((it) => (
                  <tr key={it.cod} className="border-b border-zinc-800/60">
                    <td className="py-1 pr-3 font-mono text-amber-400">{it.cod}</td>
                    <td className="py-1 text-zinc-300">{it.descricao}</td>
                    <td className="py-1 pl-3 text-right text-zinc-500">{it.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            <span>{finalFolha.itens.length} itens encontrados</span>
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

