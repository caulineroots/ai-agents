'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export type DrawerType = 'lead' | 'task' | 'project' | 'financial' | 'goal';

interface CreateDrawerProps {
  open: boolean;
  onClose: () => void;
  type: DrawerType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (item: any) => void;
}

const TYPE_LABELS: Record<DrawerType, string> = {
  lead: 'Novo Lead',
  task: 'Nova Tarefa',
  project: 'Novo Projeto',
  financial: 'Novo Lançamento',
  goal: 'Novo Objetivo',
};

// ── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors';

const selectCls =
  'w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors appearance-none';

// ── Forms per type ───────────────────────────────────────────────────────────

function LeadForm({ state, set }: { state: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Nome" required>
        <input className={inputCls} placeholder="Ex: João Silva" value={state.title ?? ''} onChange={e => set('title', e.target.value)} />
      </Field>
      <Field label="Empresa">
        <input className={inputCls} placeholder="Ex: Marmoraria Belo" value={state.empresa ?? ''} onChange={e => set('empresa', e.target.value)} />
      </Field>
      <Field label="Telefone">
        <input className={inputCls} placeholder="(11) 99999-9999" value={state.telefone ?? ''} onChange={e => set('telefone', e.target.value)} />
      </Field>
      <Field label="Interesse / Produto">
        <input className={inputCls} placeholder="Ex: Bancada de mármore para cozinha" value={state.interesse ?? ''} onChange={e => set('interesse', e.target.value)} />
      </Field>
      <Field label="Status inicial">
        <select className={selectCls} value={state.status ?? 'novo'} onChange={e => set('status', e.target.value)}>
          <option value="novo">Novo</option>
          <option value="em_contato">Em contato</option>
          <option value="qualificado">Qualificado</option>
        </select>
      </Field>
    </>
  );
}

function TaskForm({ state, set }: { state: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Título da tarefa" required>
        <input className={inputCls} placeholder="Ex: Ligar para cliente até sexta" value={state.title ?? ''} onChange={e => set('title', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prazo">
          <input type="date" className={inputCls} value={state.prazo ?? ''} onChange={e => set('prazo', e.target.value)} />
        </Field>
        <Field label="Hora">
          <input type="time" className={inputCls} value={state.prazo_hora ?? ''} onChange={e => set('prazo_hora', e.target.value)} />
        </Field>
      </div>
      <Field label="Urgência">
        <select className={selectCls} value={state.urgencia ?? 'media'} onChange={e => set('urgencia', e.target.value)}>
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </select>
      </Field>
      <Field label="Status">
        <select className={selectCls} value={state.status ?? 'pendente'} onChange={e => set('status', e.target.value)}>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
        </select>
      </Field>
    </>
  );
}

function ProjectForm({ state, set }: { state: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Nome do projeto" required>
        <input className={inputCls} placeholder="Ex: Reforma cozinha — Silva" value={state.title ?? ''} onChange={e => set('title', e.target.value)} />
      </Field>
      <Field label="Cliente">
        <input className={inputCls} placeholder="Ex: Ana Silva" value={state.cliente ?? ''} onChange={e => set('cliente', e.target.value)} />
      </Field>
      <Field label="Valor estimado (R$)">
        <input type="number" className={inputCls} placeholder="0,00" min={0} step={0.01} value={state.valor_estimado ?? ''} onChange={e => set('valor_estimado', e.target.value)} />
      </Field>
      <Field label="Status">
        <select className={selectCls} value={state.status ?? 'ativo'} onChange={e => set('status', e.target.value)}>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="concluido">Concluído</option>
        </select>
      </Field>
    </>
  );
}

function FinancialForm({ state, set }: { state: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Descrição" required>
        <input className={inputCls} placeholder="Ex: Pagamento bancada granito" value={state.title ?? ''} onChange={e => set('title', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" required>
          <input type="number" className={inputCls} placeholder="0,00" min={0} step={0.01} value={state.valor ?? ''} onChange={e => set('valor', e.target.value)} />
        </Field>
        <Field label="Tipo" required>
          <select className={selectCls} value={state.tipo ?? 'receita'} onChange={e => set('tipo', e.target.value)}>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </Field>
      </div>
      <Field label="Data">
        <input type="date" className={inputCls} value={state.data ?? new Date().toISOString().slice(0, 10)} onChange={e => set('data', e.target.value)} />
      </Field>
      <Field label="Projeto relacionado">
        <input className={inputCls} placeholder="Ex: Reforma cozinha — Silva" value={state.projeto ?? ''} onChange={e => set('projeto', e.target.value)} />
      </Field>
    </>
  );
}

function GoalForm({ state, set }: { state: Record<string, string>; set: (k: string, v: string) => void }) {
  return (
    <>
      <Field label="Descrição" required>
        <input
          className={inputCls}
          placeholder="Ex: Fazer 5 vendas na semana"
          value={state.title ?? ''}
          onChange={e => set('title', e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Período">
          <select className={selectCls} value={state.periodo ?? 'semanal'} onChange={e => set('periodo', e.target.value)}>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
        </Field>
        <Field label="Meta (número)">
          <input
            className={inputCls}
            type="number"
            min="1"
            placeholder="Ex: 5"
            value={state.meta_valor ?? ''}
            onChange={e => set('meta_valor', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Unidade">
        <input
          className={inputCls}
          placeholder="Ex: vendas, leads, projetos..."
          value={state.unidade ?? ''}
          onChange={e => set('unidade', e.target.value)}
        />
      </Field>
      <Field label="Keywords (separadas por vírgula)">
        <input
          className={inputCls}
          placeholder="Ex: follow up, vendas, proposta"
          value={state.keywords ?? ''}
          onChange={e => set('keywords', e.target.value)}
        />
        <p className="text-xs text-zinc-600 mt-1">
          Tarefas com essas palavras aparecerão como relacionadas ao objetivo.
        </p>
      </Field>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CreateDrawer({ open, onClose, type, onCreated }: CreateDrawerProps) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) {
      setFields({
        status: type === 'task' ? 'pendente' : type === 'project' ? 'ativo' : 'novo',
        tipo: 'receita',
        urgencia: 'media',
        data: new Date().toISOString().slice(0, 10),
        periodo: 'semanal',
      });
      setError('');
    }
  }, [open, type]);

  function set(key: string, value: string) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.title?.trim()) {
      setError('O campo nome/título é obrigatório.');
      return;
    }

    setLoading(true);
    setError('');

    const typeMap: Record<DrawerType, string> = {
      lead: 'lead',
      task: 'task',
      project: 'project',
      financial: 'financial',
      goal: 'goal',
    };

    const { title, ...rest } = fields;

    const metadata: Record<string, unknown> = {};
    if (type === 'lead') {
      if (rest.empresa) metadata.empresa = rest.empresa;
      if (rest.telefone) metadata.telefone = rest.telefone;
      if (rest.interesse) metadata.interesse = rest.interesse;
      metadata.status = rest.status ?? 'novo';
      metadata.qualificado = false;
    } else if (type === 'task') {
      if (rest.prazo) metadata.prazo = rest.prazo;
      if (rest.prazo_hora) metadata.prazo_hora = rest.prazo_hora;
      metadata.urgencia = rest.urgencia ?? 'media';
      metadata.status = rest.status ?? 'pendente';
    } else if (type === 'project') {
      if (rest.cliente) metadata.cliente = rest.cliente;
      if (rest.valor_estimado) metadata.valor_estimado = parseFloat(rest.valor_estimado);
      metadata.status = rest.status ?? 'ativo';
    } else if (type === 'financial') {
      metadata.valor = rest.valor ? parseFloat(rest.valor) : 0;
      metadata.tipo = rest.tipo ?? 'receita';
      metadata.data = rest.data ?? new Date().toISOString().slice(0, 10);
      if (rest.projeto) metadata.projeto = rest.projeto;
    } else if (type === 'goal') {
      metadata.periodo = rest.periodo ?? 'semanal';
      metadata.unidade = rest.unidade?.trim() || 'itens';
      metadata.meta_valor = rest.meta_valor ? parseFloat(rest.meta_valor) : 1;
      metadata.progresso_atual = 0;
      metadata.keywords = rest.keywords
        ? rest.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : [];
      metadata.status = 'ativo';
      // Referência de período
      const agora = new Date();
      if (metadata.periodo === 'semanal') {
        const d = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        metadata.semana_ref = `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
      } else {
        metadata.mes_ref = agora.toISOString().slice(0, 7);
      }
    }

    try {
      const res = await fetch('/api/dashboard/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: typeMap[type], title: title.trim(), metadata }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Erro ao criar item.');
        return;
      }

      const created = await res.json();
      onCreated(created);
      onClose();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-screen w-full max-w-md z-50 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-zinc-100">{TYPE_LABELS[type]}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {type === 'lead' && <LeadForm state={fields} set={set} />}
            {type === 'task' && <TaskForm state={fields} set={set} />}
            {type === 'project' && <ProjectForm state={fields} set={set} />}
            {type === 'financial' && <FinancialForm state={fields} set={set} />}
            {type === 'goal' && <GoalForm state={fields} set={set} />}

            {error && (
              <p className="text-sm text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-sm font-medium text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Salvando...' : 'Criar'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
