'use client';

import { useEffect } from 'react';

export default function OrcamentoConstutoraLayout({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--background', '#f9fafb');
    root.style.setProperty('--foreground', '#111827');
    document.body.style.background = '#f9fafb';
    document.body.style.color = '#111827';
    return () => {
      root.style.setProperty('--background', '#0a0a0f');
      root.style.setProperty('--foreground', '#ededed');
      document.body.style.background = '';
      document.body.style.color = '';
    };
  }, []);

  return children;
}
