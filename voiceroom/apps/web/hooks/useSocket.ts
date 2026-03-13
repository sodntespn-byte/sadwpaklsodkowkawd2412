'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = io(SOCKET_URL, {
      auth: { accessToken },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      setConnected(true);
      setSocket(s);
    });
    s.on('disconnect', () => {
      setConnected(false);
      setSocket(null);
    });
    s.on('connect_error', (err) => {
      console.error('Socket connect_error', err.message);
      setConnected(false);
    });

    return () => {
      s.close();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken]);

  return { socket, connected };
}
