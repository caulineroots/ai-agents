'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  FolderOpen,
  TrendingUp,
  Bell,
  Target,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/leads', label: 'Leads / CRM', icon: Users },
  { href: '/dashboard/tarefas', label: 'Tarefas', icon: CheckSquare },
  { href: '/dashboard/projetos', label: 'Projetos', icon: FolderOpen },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: TrendingUp },
  { href: '/dashboard/objetivos', label: 'Objetivos', icon: Target },
  { href: '/dashboard/lembretes', label: 'Lembretes', icon: Bell },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/dashboard/auth', { method: 'DELETE' });
    router.replace('/login');
  }

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col z-40 transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Brand + toggle */}
      <div className="flex items-center h-14 px-3 border-b border-zinc-800 flex-shrink-0 overflow-hidden">
        {!collapsed && (
          <span className="flex-1 text-sm font-bold tracking-tight whitespace-nowrap overflow-hidden mr-1">
            <span className="text-violet-400">Cauline</span>
            <span className="text-zinc-100"> Dashboard</span>
          </span>
        )}
        <button
          onClick={onToggle}
          className={`p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0 ${
            collapsed ? 'mx-auto' : ''
          }`}
          title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 mx-2 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Icon
                size={17}
                className={`flex-shrink-0 transition-colors ${
                  active ? 'text-violet-400' : 'text-zinc-500 group-hover:text-zinc-300'
                }`}
              />
              {!collapsed && (
                <span className="whitespace-nowrap text-[13px]">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider + Logout */}
      <div className="p-2 border-t border-zinc-800 flex-shrink-0">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={collapsed ? 'Sair' : undefined}
          className={`flex items-center gap-3 w-full px-2.5 py-2.5 rounded-lg text-sm text-zinc-600 hover:text-rose-400 hover:bg-rose-400/5 transition-colors disabled:opacity-40 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span className="text-[13px]">{loggingOut ? 'Saindo...' : 'Sair'}</span>}
        </button>
      </div>
    </aside>
  );
}
