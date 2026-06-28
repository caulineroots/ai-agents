import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orçamento de Marcenaria por IA',
  description: 'Gere pré-orçamentos de móveis sob medida a partir de pranchas de projeto arquitetônico.',
};

export default function OrcamentoMarcenariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowY: 'auto', overflowX: 'hidden', width: '100%', height: '100%', position: 'relative' }}>
      {children}
    </div>
  );
}
