'use client';

import Link from 'next/link';
import { useAuth } from '@app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiUsers, FiLogOut } from 'react-icons/fi';

export default function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  // Get username from email (everything before @)
  const username = user?.email?.split('@')[0] || 'User';

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                File Manager
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <span className="text-gray-700 font-medium">
                  {username}
                </span>
                {user.email?.includes('admin') && (
                  <>
                    <Link
                      href="/signup"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Add User
                    </Link>
                    <Link
                      href="/users"
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <FiUsers />
                      Manage Users
                    </Link>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <FiLogOut />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 