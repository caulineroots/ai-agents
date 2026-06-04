'use client';

import { useState, useCallback, useRef } from 'react';
import type { PranchaGroup }        from '@/lib/orcamento-construtora/image-store';
import type { PranchaExtractResult, PranchaLeitura, TokenLog } from '@/hooks/useOrcamentoSession';
import type { FolhaOrcamento, ItemOrcamento, Categoria, Unidade } from '@/lib/orcamento-construtora/types';
import { mergeFolhas } from '@/lib/orcamento-construtora/merge-folhas';

// ─── Tipos locais ─────────────────────────────────────────────────────────────

export interface OrquestradorResult {
  contexto_projeto: string;
  cliente: string;
  projeto: string;
  categorias_cobertas:    string[];
  categorias_ausentes:    string[];
  gaps_globais:           string[];
  fontes_primarias?:      Record<string, string>;
  pranchas_para_detalhar: {
    stem: string;
    motivo: string;
    prioridade: number;
    perguntas: string[];
    escopo_permitido?: string[];
    escopo_proibido?:  string[];
  }[];
  pranchas_dispensadas:   { stem: string; motivo: string }[];
  metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
}

interface BatchRecord {
  batch:    number;
  stems:    string[];
  batched?: Record<string, RawIAItem[]>;
  erro?:    string;
  stats?:   {
    enviado_aguardando: number;
    enviado_confirmados: number;
    retornado_novos: number;
    retornado_preenchidos: number;
    descartados_fix2: string[];  // fora do escopo proibido
    descartados_fix3: string[];  // similar a item PDF
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
  r?:          string;   // raciocínio em keywords
  pendencias?: string[];
}

// ─── Helper: deriva ambiente a partir do stem do arquivo ─────────────────────

function stemToAmbiente(stem: string): string {
  const s = stem.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 _-]/g, ' ');

  if (/PROVAD/.test(s))                               return 'Provadores';
  if (/SANITARI|BANHEIRO|\bWC\b/.test(s))             return 'Sanitários';
  if (/\bCOPA\b|CANTINA|COZINHA/.test(s))             return 'Copa';
  if (/\bDOCA/.test(s))                               return 'Docas';
  if (/ESCADA/.test(s))                               return 'Escada';
  if (/REUNIA|REUNI/.test(s))                         return 'Reuniões';
  if (/FACHADA|VITRIN/.test(s))                       return 'Fachada';
  if (/DESCOMPRESS|DECOMPRESSAO|DESCANSO/.test(s))    return 'Descompressão';
  if (/\bADM\b|ADMIN|GERENC/.test(s))                 return 'ADM';
  if (/ESTOQUE|RESERVA|DEPOSITO/.test(s))             return 'Estoque';
  if (/VESTIARIO|VESTIARIOS/.test(s))                 return 'Vestiários';
  if (/\bCIVIL\b/.test(s))                            return 'Loja Geral';
  if (/AXONOM/.test(s))                               return 'Loja Geral';
  if (/\bDEC\b|DECOR/.test(s))                        return 'Decoração';
  if (/\bARQ\b|ARQUIT/.test(s))                       return 'Loja Geral';
  return 'Geral';
}

// ─── Helper: mapeia item bruto da IA → ItemOrcamento ─────────────────────────

let _idCounter = Date.now(); // module-level seed avoids collisions across re-mounts

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
  };
}

// ─── Helper: comprime imagem para JPEG ───────────────────────────────────────

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

// ─── Sub-componente: card da leitura de uma prancha ──────────────────────────

function LeituraCard({ leitura }: { leitura: PranchaLeitura }) {
  const [open, setOpen] = useState(false);

  const coberturaColor = {
    boa:    'bg-green-100 text-green-700',
    parcial:'bg-yellow-100 text-yellow-700',
    minima: 'bg-orange-100 text-orange-700',
    nenhuma:'bg-red-100 text-red-700',
  }[leitura.cobertura_codigo] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className={`rounded-lg border transition-colors ${
      leitura.relevante ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
    }`}>
      {/* Header sempre visível */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 rounded-lg transition-colors"
      >
        <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1 ${leitura.relevante ? 'bg-green-400' : 'bg-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-800">{leitura.ambiente}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${coberturaColor}`}>
              {leitura.cobertura_codigo}
            </span>
            {leitura.tipo && (
              <span className="text-xs text-gray-400 italic">{leitura.tipo}</span>
            )}
          </div>
          {/* Resumo visível sem precisar abrir */}
          {leitura.resumo && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{leitura.resumo}</p>
          )}
        </div>
        <span className="text-gray-300 text-xs flex-shrink-0 mt-0.5">{open ? '▲' : '▼'}</span>
      </button>

      {/* Detalhe: itens vistos + observações */}
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-gray-100 pt-2">
          {leitura.itens_vistos.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {leitura.itens_vistos.map((it, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full text-xs">
                  {it}
                </span>
              ))}
            </div>
          )}
          {leitura.observacoes && (
            <p className="text-xs text-gray-400 italic">{leitura.observacoes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: card de um batch de detalhe ─────────────────────────────

function BatchCard({ br }: { br: BatchRecord }) {
  const [open, setOpen] = useState(false);
  const totalItens = Object.values(br.batched ?? {}).reduce((s, arr) => s + arr.length, 0);
  const s = br.stats;

  return (
    <div className={`border rounded-xl overflow-hidden ${br.erro ? 'border-red-200' : 'border-gray-200'}`}>
      <button
        onClick={() => !br.erro && setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          br.erro ? 'bg-red-50 cursor-default' : 'bg-gray-50 hover:bg-gray-100 cursor-pointer'
        }`}
      >
        <span className={`font-bold text-sm flex-shrink-0 ${br.erro ? 'text-red-500' : 'text-green-600'}`}>
          {br.erro ? '✕' : '✓'}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm font-semibold text-gray-800">Batch {br.batch}</span>
          <span className="text-xs text-gray-500 ml-2">{br.stems.map(s => s.split('-').slice(-1)[0]).join(' · ')}</span>
        </div>
        {!br.erro && s && (
          <div className="flex items-center gap-2 flex-shrink-0 text-xs">
            <span className="text-gray-400">{s.enviado_aguardando}↑</span>
            <span className="text-green-600">{s.retornado_novos + s.retornado_preenchidos}↓</span>
            {(s.descartados_fix2.length + s.descartados_fix3.length) > 0 && (
              <span className="text-orange-500">
                {s.descartados_fix2.length + s.descartados_fix3.length}⚠
              </span>
            )}
            <span className="text-gray-300">{open ? '▲' : '▼'}</span>
          </div>
        )}
        {!br.erro && !s && (
          <span className="text-xs text-gray-400 flex-shrink-0">{totalItens} itens {open ? '▲' : '▼'}</span>
        )}
      </button>

      {br.erro && <p className="px-4 py-2 text-xs text-red-600">{br.erro}</p>}

      {open && (
        <div className="divide-y divide-gray-100">
          {/* Stats bar */}
          {s && (
            <div className="px-4 py-2 bg-gray-50 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>Enviado: <b className="text-gray-700">{s.enviado_confirmados}</b> PDF + <b className="text-gray-700">{s.enviado_aguardando}</b> aguardando</span>
              <span>Retornado: <b className="text-green-700">{s.retornado_novos}</b> novos · <b className="text-blue-700">{s.retornado_preenchidos}</b> preenchidos</span>
              {s.descartados_fix3.length > 0 && (
                <span className="text-orange-600">Fix-3 (PDF duplicado): {s.descartados_fix3.join(', ')}</span>
              )}
              {s.descartados_fix2.length > 0 && (
                <span className="text-orange-600">Fix-2 (escopo proibido): {s.descartados_fix2.join(', ')}</span>
              )}
            </div>
          )}
          {/* Items por prancha */}
          {br.batched && Object.entries(br.batched).map(([stem, itens]) => (
            <div key={stem} className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-600 font-mono mb-2">{stem.split('-').slice(-1)[0]} — {itens.length} itens</p>
              <div className="flex flex-col gap-1.5">
                {itens.map((it, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${
                      it.fonte === 'PDF' ? 'bg-green-400' : 'bg-purple-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800">{it.descricao}</span>
                      <span className="text-gray-400 ml-1">
                        · {it.quantidade ?? it.qty ?? '?'} {it.unidade ?? it.unid ?? ''}
                      </span>
                      {it.r && (
                        <span className="ml-1 text-indigo-400 italic">「{it.r}」</span>
                      )}
                    </div>
                    <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      it.fonte === 'PDF' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'
                    }`}>{it.fonte ?? 'IA'}</span>
                    {it.confianca != null && (
                      <span className="flex-shrink-0 text-gray-300 text-xs">{it.confianca}%</span>
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
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function StepIA({
  groups,
  extractResults,
  existingLeituraMap,
  existingOrchResult,
  onDone,
}: {
  groups:              PranchaGroup[];
  extractResults:      PranchaExtractResult[];
  existingLeituraMap:  PranchaLeitura[];
  existingOrchResult:  OrquestradorResult | null;
  onDone: (folha: FolhaOrcamento, orch: OrquestradorResult, leituraMap: PranchaLeitura[], logs: TokenLog[]) => void;
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [leituraRunning,  setLeituraRunning]  = useState(false);
  const [leituraProgress, setLeituraProgress] = useState({ done: 0, total: 0 });
  const [leituraMap,      setLeituraMap]      = useState<PranchaLeitura[]>(existingLeituraMap);
  const [leituraDone,     setLeituraDone]     = useState(existingLeituraMap.length > 0);

  const [orchRunning,  setOrchRunning]  = useState(false);
  const [orchResult,   setOrchResult]   = useState<OrquestradorResult | null>(existingOrchResult);

  const [batchRunning,  setBatchRunning]  = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [batchResults,  setBatchResults]  = useState<BatchRecord[]>([]);
  const [batchDone,     setBatchDone]     = useState(false);

  const [finalFolha, setFinalFolha] = useState<FolhaOrcamento | null>(null);
  const [tokenLogs,  setTokenLogs]  = useState<TokenLog[]>([]);
  const [erro,       setErro]       = useState('');
  const runRef = useRef(false);

  const addLog = useCallback((stage: string, meta: { tokens_input?: number; tokens_output?: number }) => {
    setTokenLogs((prev) => [...prev, {
      stage,
      usage: { input_tokens: meta.tokens_input ?? 0, output_tokens: meta.tokens_output ?? 0 },
    }]);
  }, []);

  // ── Estágio 1: Leitura Geral ───────────────────────────────────────────────

  const runLeituraGeral = useCallback(async () => {
    if (runRef.current) return;
    if (extractResults.length === 0) {
      setErro('Nenhum resultado de extração disponível. Execute o Passo 2 antes.');
      return;
    }

    runRef.current = true;
    setLeituraRunning(true);
    setLeituraMap([]);
    setLeituraDone(false);
    setErro('');

    try {
      // Garante que só processa grupos que têm imagem
      const groupsComImagem = groups.filter((g) => g.imageFile);
      const BATCH_SIZE = 6;
      const batches: PranchaGroup[][] = [];
      for (let i = 0; i < groupsComImagem.length; i += BATCH_SIZE) {
        batches.push(groupsComImagem.slice(i, i + BATCH_SIZE));
      }
      setLeituraProgress({ done: 0, total: batches.length });

      const allLeituras: PranchaLeitura[] = [];

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        const fd    = new FormData();
        const batch_items: object[] = [];

        for (let j = 0; j < batch.length; j++) {
          const g  = batch[j];
          const er = extractResults.find((r) => r.stem === g.stem);
          if (g.imageFile) {
            const compressed = await compressImageFile(g.imageFile);
            fd.append(`image_${j}`, compressed, compressed.name);
          }
          batch_items.push({
            stem:            g.stem,
            itens_extraidos: er?.itens_extraidos ?? [],
            classificacao:   er?.classificacao ?? 'IA_NECESSARIA',
            height_context:  er?.height_context ?? {},
          });
        }
        fd.append('context_json', JSON.stringify({ batch_items }));

        try {
          const r    = await fetch('/api/orcamento-construtora/ler-prancha', { method: 'POST', body: fd });
          const data = await r.json() as {
            leituras?: Record<string, PranchaLeitura>;
            metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
            error?: string;
          };
          if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
          addLog(`Leitura ${bi + 1}/${batches.length}`, data.metadata ?? {});
          const novas = Object.values(data.leituras ?? {});
          allLeituras.push(...novas);
          setLeituraMap((prev) => [...prev, ...novas]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setErro((prev) => (prev ? prev + '\n' : '') + `Leitura batch ${bi + 1}: ${msg}`);
        }

        setLeituraProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      setLeituraDone(true);
      console.log('[StepIA] Leitura Geral concluída:', allLeituras.length, 'pranchas lidas');
    } finally {
      setLeituraRunning(false);
      runRef.current = false;
    }
  }, [extractResults, groups, addLog]);

  // ── Estágio 2: Orquestrador ────────────────────────────────────────────────

  const runOrchestrator = useCallback(async () => {
    if (runRef.current || !leituraDone) return;
    runRef.current = true;
    setOrchRunning(true);
    setOrchResult(null);
    setErro('');

    const extract_summary = extractResults.map((r) => {
      const itens = r.itens_extraidos ?? [];
      const confirmados = itens.filter((it) => it.status !== 'aguardando' && (it.quantidade ?? 0) > 0);
      const aguardando  = itens.filter((it) => it.status === 'aguardando' || (it.quantidade ?? 0) === 0);
      return {
        stem:                  r.stem,
        classificacao:         r.classificacao,
        score:                 (r.debug as Record<string, unknown>)?.score ?? 0,
        n_confirmados:         confirmados.length,
        n_aguardando:          aguardando.length,
        height_context:        r.height_context ?? {},
        descricoes_aguardando: aguardando.slice(0, 6).map((it) => it.descricao ?? '').filter(Boolean),
      };
    });

    const fd = new FormData();
    fd.append('context_json', JSON.stringify({
      leitura_map:     leituraMap,
      extract_summary,
    }));

    try {
      const r    = await fetch('/api/orcamento-construtora/orquestrar', { method: 'POST', body: fd });
      const data = await r.json() as OrquestradorResult & { error?: string };
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      addLog('Orquestrador', data.metadata ?? {});
      setOrchResult(data);
    } catch (e) {
      setErro(`Orquestrador: ${e instanceof Error ? e.message : e}`);
    } finally {
      setOrchRunning(false);
      runRef.current = false;
    }
  }, [leituraDone, leituraMap, extractResults, addLog]);

  // ── Estágio 3: Batches de Detalhe ─────────────────────────────────────────

  const runBatches = useCallback(async () => {
    if (runRef.current || !orchResult) return;
    runRef.current = true;
    setBatchRunning(true);
    setErro('');
    setBatchResults([]);

    try {
    const stemsParaDetalhar = orchResult.pranchas_para_detalhar.map((p) => p.stem);

    const BATCH_SIZE = 3;
    const batches: string[][] = [];
    for (let i = 0; i < stemsParaDetalhar.length; i += BATCH_SIZE) {
      batches.push(stemsParaDetalhar.slice(i, i + BATCH_SIZE));
    }
    setBatchProgress({ done: 0, total: batches.length });

    const allBatchedRaw: Record<string, RawIAItem[]> = {};

    for (let bi = 0; bi < batches.length; bi++) {
      const batchStems = batches[bi];
      const fd         = new FormData();
      const batch_items: object[] = [];

      for (let j = 0; j < batchStems.length; j++) {
        const stem = batchStems[j];
        const g    = groups.find((g) => g.stem === stem);
        const er   = extractResults.find((r) => r.stem === stem);
        const orch = orchResult.pranchas_para_detalhar.find((p) => p.stem === stem);
        const leit = leituraMap.find((l) => l.stem === stem);

        if (g?.imageFile) {
          const compressed = await compressImageFile(g.imageFile);
          fd.append(`image_${j}`, compressed, compressed.name);
        }
        batch_items.push({
          stem,
          itens_extraidos:  er?.itens_extraidos ?? [],
          classificacao:    er?.classificacao ?? 'IA_NECESSARIA',
          height_context:   er?.height_context ?? {},
          resumo_leitura:   leit?.resumo ?? '',
          perguntas:        orch?.perguntas ?? [],
          escopo_permitido: orch?.escopo_permitido ?? [],
          escopo_proibido:  orch?.escopo_proibido ?? [],
        });
      }
      fd.append('context_json', JSON.stringify({
        contexto_projeto: orchResult.contexto_projeto,
        batch_items,
      }));

      try {
        const r    = await fetch('/api/orcamento-construtora/analisar-batch', { method: 'POST', body: fd });
        const data = await r.json() as {
          batched?: Record<string, RawIAItem[]>;
          metadata?: { tokens_input: number; tokens_output: number; custo_usd: number };
          error?: string;
        };
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        addLog(`Detalhe ${bi + 1}/${batches.length}`, data.metadata ?? {});
        Object.assign(allBatchedRaw, data.batched ?? {});

        // ── Calcula stats de debug ────────────────────────────────────────────
        const pdfKeys = new Set(
          batch_items.flatMap((bi_item) =>
            (bi_item.itens_extraidos as RawIAItem[])
              .filter((it) => it.fonte === 'PDF' && it.descricao)
              .map((it) => it.descricao!.toLowerCase().slice(0, 30))
          )
        );
        const escProibidos = batch_items.flatMap((bi_item) =>
          (bi_item.escopo_proibido as string[] | undefined) ?? []
        );

        let retNovos = 0, retPreenchidos = 0;
        const fix2: string[] = [], fix3: string[] = [];

        for (const itens of Object.values(data.batched ?? {})) {
          for (const it of itens as RawIAItem[]) {
            const descKey = (it.descricao ?? '').toLowerCase().slice(0, 30);
            const isSimilarToPDF = [...pdfKeys].some(
              (k) => k.length > 8 && descKey.includes(k.slice(0, 15))
            );
            const isOutsideScope = escProibidos.some(
              (ep) => (it.descricao ?? '').toLowerCase().includes(ep.toLowerCase().slice(0, 15))
            );
            if (isSimilarToPDF && it.fonte !== 'PDF') fix3.push(it.descricao?.slice(0, 25) ?? '');
            else if (isOutsideScope) fix2.push(it.descricao?.slice(0, 25) ?? '');
            else if ((it.quantidade ?? it.qty ?? 0) > 0) retPreenchidos++;
            else retNovos++;
          }
        }

        const enviado_aguardando = batch_items.reduce(
          (s, bi_item) => s + (bi_item.itens_extraidos as RawIAItem[]).filter((it) => it.status === 'aguardando' || !(it.quantidade ?? 0)).length, 0
        );
        const enviado_confirmados = batch_items.reduce(
          (s, bi_item) => s + (bi_item.itens_extraidos as RawIAItem[]).filter((it) => it.fonte === 'PDF' && (it.quantidade ?? 0) > 0).length, 0
        );

        setBatchResults((prev) => [...prev, {
          batch: bi + 1, stems: batchStems, batched: data.batched,
          stats: { enviado_aguardando, enviado_confirmados, retornado_novos: retNovos, retornado_preenchidos: retPreenchidos, descartados_fix2: fix2, descartados_fix3: fix3 },
        }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErro((prev) => (prev ? prev + '\n' : '') + `Batch ${bi + 1}: ${msg}`);
        setBatchResults((prev) => [...prev, { batch: bi + 1, stems: batchStems, erro: msg }]);
      }

      setBatchProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    // ── Normaliza chave para deduplicação ──────────────────────────────────
    function normKey(desc: string): string {
      return desc
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 45);
    }

    // Padrão para itens de ÁREA DE REFERÊNCIA que não devem ser precificados.
    // ABL, SV, AVL, ADM etc. são dados de contexto espacial (m² por setor),
    // não materiais para comprar.
    const AREA_REF = /^(ABL\s|SV\s|AVL\s|ÁREA\s+DE\s+PROVADORES|RESERVA\/ESTOQUE|ÁREA\s+CAIXA|ÁREA\s+TÉCNICA|CIRC[\.\s])/i;
    function isRefArea(it: RawIAItem): boolean {
      return AREA_REF.test(it.descricao ?? '') && (it.unidade === 'm2' || it.unidade === 'm²' || it.unidade === 'm');
    }

    // ── Monta FolhaOrcamento: código + IA de detalhe ───────────────────────
    const folhasPorPrancha: FolhaOrcamento[] = extractResults.map((er) => {
      const ambiente = stemToAmbiente(er.stem);

      const iaRaw   = (allBatchedRaw[er.stem] ?? []).filter((it) => !isRefArea(it));
      const iaItens = iaRaw.map((it) => mapRawItem({
        ...it,
        ambiente: (it.ambiente && it.ambiente !== 'Geral') ? it.ambiente : ambiente,
      }));

      const codeRaw   = ((er.itens_extraidos ?? []) as RawIAItem[]).filter((it) => !isRefArea(it));
      const codeItens: ItemOrcamento[] = codeRaw.map((it) => mapRawItem({
        ...it,
        fonte:    it.fonte ?? 'PDF',
        ambiente: (it.ambiente && it.ambiente !== 'Geral') ? it.ambiente : ambiente,
      }));

      const seen  = new Set(codeItens.map((c) => normKey(c.descricao)));
      const extra = iaItens.filter((it) => !seen.has(normKey(it.descricao)));

      return {
        projeto: orchResult.projeto,
        cliente: orchResult.cliente,
        itens:   [...codeItens, ...extra],
      };
    });

    const folha = mergeFolhas(folhasPorPrancha.filter((f) => f.itens.length > 0));
    setFinalFolha(folha);
    setBatchDone(true);
    } finally {
      setBatchRunning(false);
      runRef.current = false;
    }
  }, [orchResult, groups, extractResults, leituraMap, addLog]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const nParaDetalhar = orchResult?.pranchas_para_detalhar?.length ?? 0;
  const nBatches      = Math.ceil(nParaDetalhar / 3) || 0;
  const totalTokens   = tokenLogs.reduce((s, l) => s + l.usage.input_tokens + l.usage.output_tokens, 0);
  const totalCusto    = tokenLogs.reduce(
    (s, l) => s + l.usage.input_tokens * 3 / 1_000_000 + l.usage.output_tokens * 15 / 1_000_000, 0,
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Passo 3 — Análise com IA</h2>
        <p className="text-sm text-gray-500 mt-1">
          Três estágios sequenciais: leitura completa do projeto → orquestração de gaps → análise de detalhe.
        </p>
      </div>

      {/* ─── Estágio 1: Leitura Geral ───────────────────────────────────────── */}
      <div className={`border rounded-xl overflow-hidden ${
        leituraDone ? 'border-green-200' : leituraRunning ? 'border-blue-200' : 'border-gray-200'
      }`}>
        <div className={`px-4 py-3 flex items-center gap-3 ${
          leituraDone ? 'bg-green-50' : leituraRunning ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          {leituraDone
            ? <span className="text-green-600 font-bold text-sm flex-shrink-0">✓</span>
            : leituraRunning
            ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <span className="w-5 h-5 rounded-full border-2 border-gray-300 inline-flex items-center justify-center text-xs text-gray-400 flex-shrink-0">1</span>
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${leituraDone ? 'text-green-800' : leituraRunning ? 'text-blue-800' : 'text-gray-700'}`}>
              Estágio 1 — Leitura Geral do Projeto
            </p>
            <p className={`text-xs mt-0.5 ${extractResults.length === 0 && !leituraDone ? 'text-red-500' : 'text-gray-500'}`}>
              {leituraRunning
                ? `Lendo batch ${leituraProgress.done + 1}/${leituraProgress.total}… (todas as pranchas, sem pressão de qty)`
                : leituraDone
                ? `${leituraMap.length} pranchas lidas · ${leituraMap.filter((l) => l.relevante).length} relevantes`
                : extractResults.length === 0
                ? '⚠ Execute o Passo 2 primeiro'
                : `Envia todas as ${groups.filter((g) => g.imageFile).length} pranchas em batches de 6 para a IA documentar o projeto`}
            </p>
          </div>
          {!leituraDone && !leituraRunning && (
            <button
              onClick={runLeituraGeral}
              disabled={extractResults.length === 0}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ler Projeto →
            </button>
          )}
        </div>

        {/* Barra de progresso */}
        {leituraRunning && leituraProgress.total > 0 && (
          <div className="px-4 pt-3">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(leituraProgress.done / leituraProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{leituraProgress.done}/{leituraProgress.total} batches concluídos</p>
          </div>
        )}

        {/* Resultado da leitura */}
        {leituraDone && leituraMap.length > 0 && (() => {
          const relevantes  = leituraMap.filter((l) => l.relevante);
          const dispensadas = leituraMap.filter((l) => !l.relevante);
          return (
            <div className="px-4 py-3 border-t border-green-100 flex flex-col gap-3">
              {/* Relevantes */}
              {relevantes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                    {relevantes.length} relevantes para o orçamento
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto pr-1">
                    {relevantes.map((l) => (
                      <LeituraCard key={l.stem} leitura={l} />
                    ))}
                  </div>
                </div>
              )}
              {/* Sem dados úteis */}
              {dispensadas.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-gray-400 cursor-pointer flex items-center gap-1.5 select-none list-none">
                    <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                    {dispensadas.length} sem dados úteis
                    <span className="group-open:hidden">▼</span>
                    <span className="hidden group-open:inline">▲</span>
                  </summary>
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {dispensadas.map((l) => (
                      <LeituraCard key={l.stem} leitura={l} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })()}
      </div>

      {/* ─── Estágio 2: Orquestrador ────────────────────────────────────────── */}
      <div className={`border rounded-xl overflow-hidden ${
        orchResult ? 'border-green-200' : orchRunning ? 'border-blue-200' : 'border-gray-200'
      }`}>
        <div className={`px-4 py-3 flex items-center gap-3 ${
          orchResult ? 'bg-green-50' : orchRunning ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          {orchResult
            ? <span className="text-green-600 font-bold text-sm flex-shrink-0">✓</span>
            : orchRunning
            ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <span className="w-5 h-5 rounded-full border-2 border-gray-300 inline-flex items-center justify-center text-xs text-gray-400 flex-shrink-0">2</span>
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${orchResult ? 'text-green-800' : orchRunning ? 'text-blue-800' : 'text-gray-500'}`}>
              Estágio 2 — Orquestrador de Gaps
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {orchRunning
                ? 'Analisando leitura + dados de código (sem imagens)…'
                : orchResult
                ? `${nParaDetalhar} pranchas para detalhar · ${orchResult.categorias_ausentes?.length ?? 0} categorias em falta`
                : leituraDone
                ? 'Pronto para identificar gaps e decidir o que precisa de análise de detalhe'
                : 'Aguardando Estágio 1'}
            </p>
          </div>
          {leituraDone && !orchResult && !orchRunning && (
            <button
              onClick={runOrchestrator}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all"
            >
              Orquestrar →
            </button>
          )}
        </div>

        {orchResult && (
          <div className="px-4 py-4 border-t border-green-100 flex flex-col gap-3">
            {/* Contexto */}
            <div className="bg-white border border-gray-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Contexto do Projeto</p>
              <p className="text-sm text-gray-800 italic">"{orchResult.contexto_projeto}"</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>Cliente: <strong className="text-gray-700">{orchResult.cliente}</strong></span>
                <span>Projeto: <strong className="text-gray-700">{orchResult.projeto}</strong></span>
              </div>
            </div>

            {/* Categorias */}
            <div className="flex gap-3 flex-wrap">
              {orchResult.categorias_cobertas?.map((c) => (
                <span key={c} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                  ✓ {c}
                </span>
              ))}
              {orchResult.categorias_ausentes?.map((c) => (
                <span key={c} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                  ✕ {c}
                </span>
              ))}
            </div>

            {/* Gaps globais */}
            {orchResult.gaps_globais?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gaps Identificados</p>
                <div className="flex flex-col gap-1">
                  {orchResult.gaps_globais.map((g, i) => (
                    <p key={i} className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1">{g}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Pranchas para detalhar */}
            {orchResult.pranchas_para_detalhar?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Para análise de detalhe ({orchResult.pranchas_para_detalhar.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {orchResult.pranchas_para_detalhar.map((p) => (
                    <div key={p.stem} className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs">
                      <span className="font-mono font-semibold text-orange-800 flex-shrink-0">{p.stem}</span>
                      <span className="text-orange-600 flex-1">— {p.motivo}</span>
                      <span className="ml-auto text-orange-400 flex-shrink-0">P{p.prioridade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dispensadas */}
            {orchResult.pranchas_dispensadas?.length > 0 && (
              <details>
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                  {orchResult.pranchas_dispensadas.length} dispensadas ▾
                </summary>
                <div className="mt-2 flex flex-col gap-1">
                  {orchResult.pranchas_dispensadas.map((p) => (
                    <div key={p.stem} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-mono text-gray-500 flex-shrink-0">{p.stem}</span>
                      <span className="text-gray-400">— {p.motivo}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ─── Estágio 3: Batches de Detalhe ──────────────────────────────────── */}
      <div className={`border rounded-xl overflow-hidden ${
        batchDone ? 'border-green-200' : batchRunning ? 'border-blue-200' : 'border-gray-200'
      }`}>
        <div className={`px-4 py-3 flex items-center gap-3 ${
          batchDone ? 'bg-green-50' : batchRunning ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          {batchDone
            ? <span className="text-green-600 font-bold text-sm flex-shrink-0">✓</span>
            : batchRunning
            ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            : <span className="w-5 h-5 rounded-full border-2 border-gray-300 inline-flex items-center justify-center text-xs text-gray-400 flex-shrink-0">3</span>
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${batchDone ? 'text-green-800' : batchRunning ? 'text-blue-800' : 'text-gray-500'}`}>
              Estágio 3 — Análise de Detalhe
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {batchRunning
                ? `Batch ${batchProgress.done + 1}/${batchProgress.total} em andamento…`
                : batchDone
                ? `${batchProgress.total} batch${batchProgress.total !== 1 ? 'es' : ''} concluídos`
                : orchResult
                ? `${nParaDetalhar} pranchas → ${nBatches} batch${nBatches !== 1 ? 'es' : ''} com contexto rico + perguntas específicas`
                : 'Aguardando Estágio 2'}
            </p>
          </div>
          {orchResult && !batchRunning && !batchDone && (
            <button
              onClick={runBatches}
              className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all"
            >
              Detalhar ({nParaDetalhar}) →
            </button>
          )}
          {batchRunning && (
            <span className="text-xs text-blue-500 animate-pulse flex-shrink-0">
              {batchProgress.done}/{batchProgress.total} batches…
            </span>
          )}
        </div>

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

        {batchResults.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-3">
            {batchResults.map((br) => <BatchCard key={br.batch} br={br} />)}
          </div>
        )}

        {tokenLogs.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-400">
              Total: {totalTokens.toLocaleString('pt-BR')} tokens · ${totalCusto.toFixed(4)} USD
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

      {/* Resumo + CTA */}
      {finalFolha && (
        <div className="flex items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <div className="flex gap-4 text-xs text-gray-500">
            <span>{totalTokens.toLocaleString('pt-BR')} tokens</span>
            <span className="font-semibold text-gray-700">${totalCusto.toFixed(4)} USD</span>
            <span>{finalFolha.itens.length} itens identificados</span>
          </div>
          <button
            onClick={() => onDone(finalFolha, orchResult!, leituraMap, tokenLogs)}
            className="flex-shrink-0 px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all"
          >
            Ver Revisão →
          </button>
        </div>
      )}
    </div>
  );
}
