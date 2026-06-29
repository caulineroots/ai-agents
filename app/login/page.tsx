'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') ?? '/dashboard';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dashboard/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.replace(from);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Senha incorreta');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5" htmlFor="password">
            Senha de acesso
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors text-sm"
            autoFocus
            required
          />
        </div>

        {error && (
          <p className="text-rose-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded transition-colors text-sm"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="mb-8 text-center">
          <p className="text-xs tracking-widest text-violet-400 uppercase mb-2">Cauline Roots</p>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Área restrita — acesso pessoal</p>
        </div>

        {/* Suspense wraps the component that uses useSearchParams */}
        <Suspense fallback={
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 h-40 animate-pulse" />
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-zinc-600 mt-6">
          OrçamentarIA · Cauline Roots
        </p>
      </div>
    </main>
  );
}
