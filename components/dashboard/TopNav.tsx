'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const TABS = [
  { href: '/dashboard', label: 'Overview', exact: true },
  { href: '/dashboard/tarefas', label: 'Tarefas' },
  { href: '/dashboard/leads', label: 'Leads' },
  { href: '/dashboard/projetos', label: 'Projetos' },
  { href: '/dashboard/financeiro', label: 'Financeiro' },
  { href: '/dashboard/lembretes', label: 'Lembretes' },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/dashboard/auth', { method: 'DELETE' });
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-zinc-100 tracking-tight whitespace-nowrap">
              <span className="text-violet-400">Cauline</span> Dashboard
            </span>

            {/* Tabs */}
            <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
              {TABS.map((tab) => {
                const active = tab.exact
                  ? pathname === tab.href
                  : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50 ml-4 whitespace-nowrap"
          >
            {loggingOut ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </div>
    </header>
  );
}
