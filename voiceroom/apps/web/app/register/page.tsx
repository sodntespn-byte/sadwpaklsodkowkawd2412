'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres');
      return;
    }
    setLoading(true);
    const res = await register(name, email, password);
    setLoading(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-[var(--card)] border border-[var(--border)] p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-center mb-6">Criar conta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg p-2">{error}</p>
          )}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              minLength={2}
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Senha (mín. 8 caracteres)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2 font-medium disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Registrar'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-zinc-400">
          Já tem conta?{' '}
          <Link href="/login" className="text-indigo-400 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
