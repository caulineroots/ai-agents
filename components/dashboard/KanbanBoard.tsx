'use client';

import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  metadata: {
    status?: string;
    urgencia?: string;
    prazo?: string;
  };
}

interface Props {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
}

const COLUMNS = [
  { id: 'pendente', label: 'Pendente', color: 'border-amber-500/30 bg-amber-500/5' },
  { id: 'em_andamento', label: 'Em andamento', color: 'border-violet-500/30 bg-violet-500/5' },
  { id: 'concluida', label: 'Concluída', color: 'border-emerald-500/30 bg-emerald-500/5' },
];

const URGENCY_DOT: Record<string, string> = {
  alta: 'bg-rose-500',
  media: 'bg-amber-400',
  baixa: 'bg-zinc-600',
};

export function KanbanBoard({ tasks, onStatusChange }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const getStatus = (task: Task) => optimistic[task.id] ?? task.metadata?.status ?? 'pendente';

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDragging(taskId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colId);
  }

  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault();
    setDragOver(null);

    if (!dragging || colId === getStatus(tasks.find((t) => t.id === dragging)!)) {
      setDragging(null);
      return;
    }

    setOptimistic((prev) => ({ ...prev, [dragging]: colId }));
    onStatusChange(dragging, colId).catch(() => {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[dragging];
        return next;
      });
    });
    setDragging(null);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => getStatus(t) === col.id);
        const isOver = dragOver === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragLeave={() => setDragOver(null)}
            className={`rounded-lg border ${col.color} ${
              isOver ? 'ring-2 ring-violet-500/40 scale-[1.01]' : ''
            } transition-all min-h-48 p-3 flex flex-col gap-2`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {col.label}
              </span>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>

            {/* Tasks */}
            {colTasks.map((task) => {
              const urg = task.metadata?.urgencia ?? 'baixa';
              const dotClass = URGENCY_DOT[urg] ?? 'bg-zinc-600';
              const isDragging = dragging === task.id;

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  className={`bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none transition-all ${
                    isDragging ? 'opacity-40 scale-95' : 'hover:border-zinc-700 hover:bg-zinc-800/80'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 leading-snug">{task.title}</p>
                      {task.metadata?.prazo && (
                        <p className="text-xs text-zinc-500 mt-1">
                          📅 {formatDate(task.metadata.prazo)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {colTasks.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-700 py-6">
                {isOver ? 'Soltar aqui' : 'Sem tarefas'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

