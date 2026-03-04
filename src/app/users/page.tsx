'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import UserManagement from '@/components/UserManagement';
import AppShell from '@/components/AppShell';

export default function Users() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !user.email?.includes('admin'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ms-background)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--ms-neutral-30)', borderTopColor: 'var(--ms-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || !user.email?.includes('admin')) return null;

  return (
    <AppShell>
      <UserManagement />
    </AppShell>
  );
}