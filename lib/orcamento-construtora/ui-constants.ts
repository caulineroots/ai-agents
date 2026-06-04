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
  civil:        'bg-stone-100 text-stone-700 border-stone-300',
  eletrica:     'bg-yellow-50 text-yellow-700 border-yellow-300',
  hidraulica:   'bg-blue-50 text-blue-700 border-blue-300',
  marcenaria:   'bg-amber-50 text-amber-700 border-amber-300',
  vidros:       'bg-cyan-50 text-cyan-700 border-cyan-300',
  revestimento: 'bg-purple-50 text-purple-700 border-purple-300',
  pintura:      'bg-pink-50 text-pink-700 border-pink-300',
  fachada:      'bg-orange-50 text-orange-700 border-orange-300',
  climatizacao: 'bg-teal-50 text-teal-700 border-teal-300',
  outro:        'bg-gray-50 text-gray-600 border-gray-300',
};

export const STATUS_LABEL = {
  confirmado: { label: '100% confirmado',       color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' },
  parcial:    { label: 'Estimativa — confirmar', color: 'text-blue-700 bg-blue-50 border-blue-200',   dot: 'bg-blue-400'  },
  aguardando: { label: 'Não identificado',       color: 'text-red-700 bg-red-50 border-red-200',      dot: 'bg-red-400'   },
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
