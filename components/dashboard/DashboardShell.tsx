'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  // w-14 = 56px collapsed, w-56 = 224px expanded
  const sidebarWidth = collapsed ? 56 : 224;

  return (
    <div className="min-h-screen bg-black text-zinc-100 antialiased">
      {mounted && <Sidebar collapsed={collapsed} onToggle={toggle} />}
      <main
        className="min-h-screen transition-[margin] duration-300 ease-in-out"
        style={{ marginLeft: mounted ? sidebarWidth : 224 }}
      >
        <div className="p-6 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
