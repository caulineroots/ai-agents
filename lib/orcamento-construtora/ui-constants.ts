import type { Categoria } from './types';

export const PRICE_INPUT  = 3  / 1_000_000;
export const PRICE_OUTPUT = 15 / 1_000_000;

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  civil:         'Civil',
  eletrica:      'Elétrica',
  hidraulica:    'Hidráulica',
  marcenaria:    'Marcenaria',
  vidros:        'Vidros',
  revestimento:  'Revestimento',
  pintura:       'Pintura',
  fachada:       'Fachada',
  climatizacao:  'Climatização',
  outro:         'Outro',
};

export const CATEGORIA_COLOR: Record<Categoria, string> = {
  civil:        'bg-stone-700 text-stone-100 border-stone-500',
  eletrica:     'bg-yellow-500 text-yellow-950 border-yellow-400',
  hidraulica:   'bg-blue-600 text-blue-50 border-blue-400',
  marcenaria:   'bg-amber-500 text-amber-950 border-amber-400',
  vidros:       'bg-cyan-600 text-cyan-50 border-cyan-400',
  revestimento: 'bg-purple-600 text-purple-50 border-purple-400',
  pintura:      'bg-pink-600 text-pink-50 border-pink-400',
  fachada:      'bg-orange-500 text-orange-950 border-orange-400',
  climatizacao: 'bg-teal-600 text-teal-50 border-teal-400',
  outro:        'bg-zinc-600 text-zinc-100 border-zinc-400',
};

export const STATUS_LABEL = {
  confirmado: { label: 'Confirmado',      color: 'text-zinc-200 bg-zinc-800/80 border-zinc-700',       dot: 'bg-green-500' },
  parcial:    { label: 'Pendente',        color: 'text-zinc-200 bg-zinc-800/80 border-amber-700/60',   dot: 'bg-amber-400' },
  aguardando: { label: 'Não Identificado', color: 'text-zinc-200 bg-red-950/30 border-red-800/60',     dot: 'bg-red-500'   },
};

export const FONTE_BADGE: Record<string, string> = {
  PDF:          'bg-green-100 text-green-700 border-green-300',
  DXF:          'bg-blue-100 text-blue-700 border-blue-300',
  IA:           'bg-purple-100 text-purple-700 border-purple-300',
  'PDF+DXF':    'bg-teal-100 text-teal-700 border-teal-300',
  'PDF+IA':     'bg-emerald-100 text-emerald-700 border-emerald-300',
  'DXF+IA':     'bg-indigo-100 text-indigo-700 border-indigo-300',
  'PDF+DXF+IA': 'bg-cyan-100 text-cyan-700 border-cyan-300',
};

export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
