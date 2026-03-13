'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useVoiceRoom } from '@/hooks/useVoiceRoom';
import type { Participant } from '@voiceroom/shared';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { user, accessToken, isAuthenticated } = useAuth();
  const { socket, connected } = useSocket();
  const remoteStreamsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const {
    participants,
    connectionStatus,
    error,
    isMuted,
    setMuted,
  } = useVoiceRoom({
    roomId,
    socket,
    userId: user?.id ?? '',
    userName: user?.name ?? 'User',
    onRemoteTrack: (socketId, stream) => {
      let el = remoteStreamsRef.current.get(socketId);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        el.setAttribute('data-socket-id', socketId);
        remoteStreamsRef.current.set(socketId, el);
      }
      el.srcObject = stream;
    },
  });

  useEffect(() => {
    if (!isAuthenticated || !accessToken) router.replace('/login');
  }, [isAuthenticated, accessToken, router]);

  useEffect(() => {
    return () => {
      remoteStreamsRef.current.forEach((el) => {
        el.srcObject = null;
      });
      remoteStreamsRef.current.clear();
    };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-400">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-zinc-400 hover:text-white">
            ← Voltar
          </Link>
          <h1 className="text-xl font-semibold">Sala de voz</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-sm ${
              connected ? 'text-green-400' : 'text-amber-400'
            }`}
          >
            {connected ? 'Conectado' : 'Conectando...'}
          </span>
          <span
            className={`text-sm ${
              connectionStatus === 'connected'
                ? 'text-green-400'
                : connectionStatus === 'error'
                ? 'text-red-400'
                : 'text-zinc-400'
            }`}
          >
            {connectionStatus === 'idle' && '—'}
            {connectionStatus === 'connecting' && 'Entrando...'}
            {connectionStatus === 'connected' && 'Na sala'}
            {connectionStatus === 'error' && (error || 'Erro')}
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-400/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {participants.map((p) => (
          <ParticipantCard key={p.socketId} participant={p} isSelf={p.userId === user?.id} />
        ))}
      </div>

      <footer className="mt-6 flex justify-center gap-4">
        <button
          onClick={() => setMuted(!isMuted)}
          className={`rounded-full w-14 h-14 flex items-center justify-center font-medium ${
            isMuted ? 'bg-red-500/20 text-red-400' : 'bg-indigo-600 text-white'
          }`}
          title={isMuted ? 'Desmutar' : 'Mutar'}
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
        <Link
          href="/dashboard"
          className="rounded-full w-14 h-14 flex items-center justify-center bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30"
          title="Sair da sala"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 10v-2l6 6-6 6v-2h-4v-4H4v-4h8z" />
          </svg>
        </Link>
      </footer>
    </div>
  );
}

function ParticipantCard({
  participant,
  isSelf,
}: {
  participant: Participant;
  isSelf: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        participant.isSpeaking ? 'border-green-500/50 bg-green-500/5' : 'border-[var(--border)] bg-[var(--card)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium ${
            participant.isSpeaking ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-300'
          }`}
        >
          {participant.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">
            {participant.name}
            {isSelf && <span className="text-zinc-500 ml-1">(você)</span>}
          </p>
          <p className="text-sm text-zinc-400">
            {participant.isMuted ? 'Mudo' : 'Com áudio'} ·{' '}
            {participant.isSpeaking ? 'Falando' : 'Silêncio'}
          </p>
        </div>
      </div>
    </div>
  );
}
