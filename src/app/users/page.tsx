'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import UserManagement from '@/components/UserManagement';
import Navigation from '@/components/Navigation';
import { FiUsers } from 'react-icons/fi';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || !user.email?.includes('admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <div className="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 border-blue-500 text-blue-600">
                <FiUsers />
                User Management
              </div>
            </nav>
          </div>
        </div>
        <UserManagement />
      </div>
    </div>
  );
} 