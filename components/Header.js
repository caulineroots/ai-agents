"use client";

import { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold">
              A
            </div>
            <span className="text-lg font-semibold tracking-tight">
              AI Agents
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <a href="#" className="hover:text-white transition-colors">Dashboard</a>
            <a href="#" className="hover:text-white transition-colors">Agents</a>
            <a href="#" className="hover:text-white transition-colors">Logs</a>
            <a href="#" className="hover:text-white transition-colors">Settings</a>
          </nav>

          <button
            className="hidden md:flex items-center gap-2 bg-violet-600 hover:bg-violet-700 transition-colors text-sm font-medium px-4 py-2 rounded-lg"
            type="button"
          >
            + New Agent
          </button>

          <button
            className="md:hidden p-2 rounded-md text-white/60 hover:text-white"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-3 text-sm text-white/60">
            <a href="#" className="hover:text-white transition-colors">Dashboard</a>
            <a href="#" className="hover:text-white transition-colors">Agents</a>
            <a href="#" className="hover:text-white transition-colors">Logs</a>
            <a href="#" className="hover:text-white transition-colors">Settings</a>
          </nav>
        )}
      </div>
    </header>
  );
}
