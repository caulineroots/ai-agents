'use client';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelect {
  key: string;
  label: string;
  options: FilterOption[];
}

interface Props {
  search: string;
  onSearch: (v: string) => void;
  filters?: FilterSelect[];
  filterValues?: Record<string, string>;
  onFilter?: (key: string, value: string) => void;
  placeholder?: string;
  rightSlot?: React.ReactNode;
}

export function FilterBar({
  search,
  onSearch,
  filters = [],
  filterValues = {},
  onFilter,
  placeholder = 'Buscar...',
  rightSlot,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-9 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => onSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter selects */}
      {filters.map((f) => (
        <select
          key={f.key}
          value={filterValues[f.key] ?? ''}
          onChange={(e) => onFilter?.(f.key, e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
        >
          <option value="">{f.label}</option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {/* Right slot for extra buttons */}
      {rightSlot}
    </div>
  );
}
