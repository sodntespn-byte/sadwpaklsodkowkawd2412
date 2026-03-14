'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) router.replace('/dashboard');
    else router.replace('/login');
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-400">Redirecionando...</p>
    </div>
  );
}
