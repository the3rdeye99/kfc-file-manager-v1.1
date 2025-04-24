'use client';

import Link from 'next/link';
import { useAuth } from '@app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiUsers, FiLogOut, FiTrash2, FiUser, FiChevronDown } from 'react-icons/fi';
import { useState } from 'react';

export default function Navigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
          <div className="flex items-center">
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <FiUser className="w-5 h-5" />
                  <span className="font-medium">{username}</span>
                  <FiChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`} />
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    {user.email?.includes('admin') && (
                      <>
                        <Link
                          href="/signup"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <FiUser />
                          Add User
                        </Link>
                        <Link
                          href="/users"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <FiUsers />
                          Manage Users
                        </Link>
                      </>
                    )}
                    <Link
                      href="/trash"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FiTrash2 />
                      Trash
                    </Link>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <FiLogOut />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 