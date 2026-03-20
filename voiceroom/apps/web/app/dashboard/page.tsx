'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

interface Room {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  hasPassword: boolean;
  maxCapacity: number;
  ownerId: string;
  owner: { id: string; name: string };
  participantCount: number;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken, logout, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      router.replace('/login');
      return;
    }
    (async () => {
      const res = await api<{ items: Room[] }>('/rooms', { token: accessToken });
      if (res.data) setRooms(res.data.items || []);
      setLoading(false);
    })();
  }, [accessToken, isAuthenticated, router]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    const res = await api<Room>('/rooms', {
      method: 'POST',
      token: accessToken!,
      body: JSON.stringify({ name: createName, isPrivate: false, maxCapacity: 10 }),
    });
    setCreating(false);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    if (res.data) {
      setRooms((r) => [res.data as Room, ...r]);
      setCreateName('');
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">VoiceRoom</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{user.name}</span>
          <button
            onClick={() => logout()}
            className="text-sm text-red-400 hover:underline"
          >
            Sair
          </button>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Criar sala</h2>
        <form onSubmit={createRoom} className="flex gap-2">
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Nome da sala"
            className="flex-1 rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2 text-white"
            required
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-medium disabled:opacity-50"
          >
            Criar
          </button>
        </form>
        {createError && (
          <p className="mt-2 text-sm text-red-400">{createError}</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Salas disponíveis</h2>
        {loading ? (
          <p className="text-zinc-400">Carregando...</p>
        ) : rooms.length === 0 ? (
          <p className="text-zinc-400">Nenhuma sala. Crie uma acima.</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex items-center justify-between rounded-lg bg-[var(--card)] border border-[var(--border)] p-3"
              >
                <div>
                  <p className="font-medium">{room.name}</p>
                  <p className="text-sm text-zinc-400">
                    {room.participantCount}/{room.maxCapacity} · {room.owner.name}
                  </p>
                </div>
                <Link
                  href={`/room/${room.id}`}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium"
                >
                  Entrar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
