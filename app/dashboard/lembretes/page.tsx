'use client';

import { useEffect, useState, useMemo } from 'react';

interface ReminderDoc {
  id: string;
  send_at: string;
  offset_label: string;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
  vault_document_id: string;
  vault_documents: {
    id: string;
    title: string;
    type: string;
  } | null;
}

function fmtDateTime(iso: string) {
  const dt = new Date(iso);
  const dtBRT = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
  const date = dtBRT.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = dtBRT.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

function groupByDate(reminders: ReminderDoc[]) {
  const groups: Record<string, ReminderDoc[]> = {};
  for (const r of reminders) {
    const dt = new Date(r.send_at);
    const dtBRT = new Date(dt.getTime() - 3 * 60 * 60 * 1000);
    const key = dtBRT.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function getDayLabel(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (key === today) return 'Hoje';
  if (key === tomorrow) return 'Amanhã';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

export default function LembretesPage() {
  const [reminders, setReminders] = useState<ReminderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'enviados'>('pendentes');
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/reminders')
      .then((r) => r.json())
      .then((data) => { setReminders(data); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'pendentes') return reminders.filter((r) => !r.sent);
    if (filter === 'enviados') return reminders.filter((r) => r.sent);
    return reminders;
  }, [reminders, filter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  async function cancelReminder(id: string) {
    setCancelling(id);
    try {
      await fetch(`/api/dashboard/reminders?id=${id}`, { method: 'DELETE' });
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setCancelling(null);
    }
  }

  const pendingCount = reminders.filter((r) => !r.sent).length;
  const sentCount = reminders.filter((r) => r.sent).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-500 text-sm animate-pulse">
        Carregando lembretes...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Lembretes</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {pendingCount} pendente(s) · {sentCount} enviado(s)
        </p>
      </div>

      {/* Filter tabs */}
      <div className="inline-flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 gap-0.5">
        {(['todos', 'pendentes', 'enviados'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all capitalize ${
              filter === f
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'pendentes' ? `Pendentes (${pendingCount})` : `Enviados (${sentCount})`}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          {filter === 'pendentes' ? 'Nenhum lembrete pendente.' : 'Nenhum lembrete encontrado.'}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dayReminders]) => (
            <div key={dateKey}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-zinc-300">{getDayLabel(dateKey)}</h2>
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-zinc-600">{dayReminders.length}</span>
              </div>

              {/* Reminders for this day */}
              <div className="space-y-2">
                {dayReminders.map((reminder) => {
                  const { time } = fmtDateTime(reminder.send_at);
                  const isPast = new Date(reminder.send_at) < new Date();
                  const task = reminder.vault_documents;

                  return (
                    <div
                      key={reminder.id}
                      className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                        reminder.sent
                          ? 'bg-zinc-900/40 border-zinc-800/50 opacity-60'
                          : isPast
                          ? 'bg-rose-500/5 border-rose-500/20'
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {/* Time column */}
                      <div className="w-14 flex-shrink-0 text-center">
                        <p className="text-sm font-mono font-semibold text-zinc-300">{time}</p>
                        <p className="text-xs text-zinc-600 mt-0.5">BRT</p>
                      </div>

                      {/* Connector dot */}
                      <div className="flex flex-col items-center pt-1 flex-shrink-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            reminder.sent
                              ? 'bg-zinc-600'
                              : isPast
                              ? 'bg-rose-500'
                              : 'bg-violet-500'
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded border ${
                              reminder.sent
                                ? 'bg-zinc-700/30 text-zinc-500 border-zinc-700/30'
                                : 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                            }`}
                          >
                            {reminder.offset_label}
                          </span>
                          {reminder.sent && (
                            <span className="text-xs text-emerald-400">✓ Enviado</span>
                          )}
                          {!reminder.sent && isPast && (
                            <span className="text-xs text-rose-400">⚠ Atrasado</span>
                          )}
                        </div>

                        {task ? (
                          <p className="text-sm text-zinc-200 mt-1.5 leading-snug">
                            <span className="text-zinc-500 mr-1.5">
                              {task.type === 'task' ? '📋' : '📌'}
                            </span>
                            {task.title}
                          </p>
                        ) : (
                          <p className="text-sm text-zinc-500 mt-1.5 italic">Tarefa removida</p>
                        )}
                      </div>

                      {/* Cancel button */}
                      {!reminder.sent && (
                        <button
                          onClick={() => cancelReminder(reminder.id)}
                          disabled={cancelling === reminder.id}
                          className="text-zinc-600 hover:text-rose-400 text-xs transition-colors disabled:opacity-40 flex-shrink-0"
                          title="Cancelar lembrete"
                        >
                          {cancelling === reminder.id ? '...' : '✕'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
