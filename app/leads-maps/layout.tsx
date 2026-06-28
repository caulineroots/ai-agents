import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Extrator de Leads — Google Maps',
  description: 'Extraia telefone e site de negócios no Google Maps por nicho e município.',
};

export default function LeadsMapsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {children}
    </div>
  );
}
