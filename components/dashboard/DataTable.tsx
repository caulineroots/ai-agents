'use client';

import { useState, useRef } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
  editable?: boolean;
  editType?: 'text' | 'select' | 'date' | 'number';
  editOptions?: { value: string; label: string }[];
  getValue?: (row: T) => string | number;
  onSave?: (row: T, value: string) => Promise<void>;
}

interface Props<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onDelete?: (row: T) => void;
  emptyMessage?: string;
}

interface EditingCell {
  rowId: string;
  colKey: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onDelete,
  emptyMessage = 'Nenhum item encontrado.',
}: Props<T>) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState<EditingCell | null>(null);
  const [savedCell, setSavedCell] = useState<EditingCell | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  function startEdit(row: T, col: Column<T>) {
    if (!col.editable) return;
    const value = col.getValue ? String(col.getValue(row)) : '';
    setEditing({ rowId: row.id, colKey: col.key });
    setEditValue(value);
    setTimeout(() => (inputRef.current as HTMLElement)?.focus(), 0);
  }

  async function commitEdit(row: T, col: Column<T>) {
    if (!editing || !col.onSave) {
      setEditing(null);
      return;
    }
    const cell = { rowId: row.id, colKey: col.key };
    setSavingCell(cell);
    setEditing(null);
    try {
      await col.onSave(row, editValue);
      setSavedCell(cell);
      setTimeout(() => setSavedCell(null), 1500);
    } finally {
      setSavingCell(null);
    }
  }

  function isEditing(rowId: string, colKey: string) {
    return editing?.rowId === rowId && editing?.colKey === colKey;
  }

  function isSaving(rowId: string, colKey: string) {
    return savingCell?.rowId === rowId && savingCell?.colKey === colKey;
  }

  function isSaved(rowId: string, colKey: string) {
    return savedCell?.rowId === rowId && savedCell?.colKey === colKey;
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left px-5 py-3.5 text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
            {onDelete && (
              <th className="px-5 py-3.5 text-xs font-medium text-zinc-400 uppercase tracking-wider text-right w-16">
                Ações
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id}
              className={`border-b border-zinc-800/40 transition-colors hover:bg-zinc-900/50 group ${
                idx % 2 === 0 ? '' : 'bg-zinc-900/20'
              }`}
            >
              {columns.map((col) => {
                const editing_cell = isEditing(row.id, col.key);
                const saving = isSaving(row.id, col.key);
                const saved = isSaved(row.id, col.key);

                return (
                  <td
                    key={col.key}
                    className={`px-5 py-4 ${col.editable ? 'cursor-pointer' : ''}`}
                    onClick={() => !editing_cell && col.editable && startEdit(row, col)}
                  >
                    {editing_cell ? (
                      <div className="relative">
                        {col.editType === 'select' && col.editOptions ? (
                          <select
                            ref={inputRef as React.RefObject<HTMLSelectElement>}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(row, col)}
                            onKeyDown={(e) => e.key === 'Enter' && commitEdit(row, col)}
                            className="bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-zinc-100 text-sm focus:outline-none w-full"
                            autoFocus
                          >
                            {col.editOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            ref={inputRef as React.RefObject<HTMLInputElement>}
                            type={col.editType ?? 'text'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(row, col)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row, col);
                              if (e.key === 'Escape') setEditing(null);
                            }}
                            className="bg-zinc-800 border border-violet-500 rounded px-2 py-1 text-zinc-100 text-sm focus:outline-none w-full min-w-24"
                            autoFocus
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-h-6">
                        <span className={saving ? 'opacity-40' : ''}>
                          {col.render ? col.render(row) : (
                            <span className="text-zinc-200">
                              {col.getValue ? col.getValue(row) : '—'}
                            </span>
                          )}
                        </span>
                        {saving && (
                          <span className="text-zinc-500 text-xs animate-pulse">salvando…</span>
                        )}
                        {saved && (
                          <span className="text-emerald-400 text-xs">✓</span>
                        )}
                        {col.editable && !saving && !saved && (
                          <span className="text-zinc-600 opacity-0 group-hover:opacity-100 text-xs">✏</span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              {onDelete && (
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => onDelete(row)}
                    className="text-zinc-700 hover:text-rose-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                    title="Deletar"
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
