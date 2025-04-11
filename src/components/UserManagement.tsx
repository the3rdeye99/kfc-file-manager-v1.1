'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiTrash2, FiArrowLeft, FiEdit2, FiX, FiLock, FiEye, FiEyeOff, FiUser, FiClock, FiUsers, FiPlus, FiSearch } from 'react-icons/fi';
import { deleteUser, updateUser, updateUserRole } from '@/app/actions/userActions';
import FileAccessHistory from './FileAccessHistory';

interface User {
  uid: string;
  email: string;
  role: 'admin' | 'viewer' | 'editor';
  displayName: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<User | null>(null);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'history'>('users');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Redirect if not admin
  if (!user?.email?.includes('admin')) {
    router.push('/');
    return null;
  }

  const handleDeleteUser = async (userId: string) => {
    // Find the user to be deleted
    const userToDelete = users.find(user => user.uid === userId);
    
    // Check if the user is an admin
    if (userToDelete?.role === 'admin') {
      toast.error('Cannot delete admin users');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteUser(userId);
      
      if (result.success) {
        setUsers(users.filter(user => user.uid !== userId));
        toast.success('User deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewName(user.displayName || '');
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !newName.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    try {
      const result = await updateUser(editingUser.uid, newName);
      
      if (result.success) {
        setUsers(users.map(user => 
          user.uid === editingUser.uid 
            ? { ...user, displayName: newName }
            : user
        ));
        setEditingUser(null);
        toast.success('User updated successfully');
      } else {
        toast.error(result.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword.trim()) {
      toast.error('Please enter a valid password');
      return;
    }

    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: selectedUser.uid,
          newPassword: newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change password');
      }

      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    }
  };

  const handleChangeRole = async (user: User, newRole: 'viewer' | 'editor') => {
    try {
      await updateUserRole(user.uid, newRole);
      toast.success(`User role updated to ${newRole}`);
      setEditingRole(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <FiArrowLeft className="mr-2" />
            Back
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="border-t border-gray-200">
            <nav className="flex space-x-8 px-4 py-3 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('users')}
                className={`${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <FiUser />
                Users
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <FiClock />
                Access History
              </button>
            </nav>
            <div className="p-4">
              {activeTab === 'users' ? (
                <ul className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <li key={user.uid} className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className={`h-2 w-2 rounded-full ${
                              user.email === 'admin@kayodefilani.com' ? 'bg-blue-500' : user.role === 'viewer' ? 'bg-green-500' : 'bg-purple-500'
                            }`} />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-black">{user.displayName || 'No name set'}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className={`text-xs font-medium ${
                              user.email === 'admin@kayodefilani.com' ? 'text-red-600' :
                              user.role === 'editor' ? 'text-purple-600' :
                              'text-green-600'
                            }`}>
                              Role: {user.email === 'admin@kayodefilani.com' ? 'admin' : (user.role || 'viewer')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.email !== 'admin@kayodefilani.com' && (
                            <>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <FiEdit2 />
                                Edit
                              </button>
                              {user.role !== 'admin' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setShowPasswordModal(true);
                                    }}
                                    className="text-purple-600 hover:text-purple-700 flex items-center gap-1"
                                  >
                                    <FiLock />
                                    Change Password
                                  </button>
                                  <button
                                    onClick={() => setEditingRole(user)}
                                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                  >
                                    <FiUser />
                                    Change Role
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.uid)}
                                    className="text-red-600 hover:text-red-700 flex items-center gap-1"
                                  >
                                    <FiTrash2 />
                                    Delete
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <FileAccessHistory />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-black">Edit User Information</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                User Email
              </label>
              <p className="text-black">{editingUser.email}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                placeholder="Enter new display name"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-black">Change User Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setSelectedUser(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                User Email
              </label>
              <p className="text-black">{selectedUser?.email}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <p className="mt-1 text-xs text-black">
                Password must be at least 6 characters long
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-black">Change User Role</h3>
              <button
                onClick={() => setEditingRole(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                User Email
              </label>
              <p className="text-black">{editingRole.email}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                Current Role
              </label>
              <p className="text-black capitalize">{editingRole.role}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">
                Select New Role
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => handleChangeRole(editingRole, 'viewer')}
                  className={`w-full p-3 border rounded-md flex items-center justify-between ${
                    editingRole.role === 'viewer' 
                      ? 'bg-green-50 border-green-500 text-green-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-black">Viewer</span>
                  <span className="text-xs text-black">Can view files only</span>
                </button>
                <button
                  onClick={() => handleChangeRole(editingRole, 'editor')}
                  className={`w-full p-3 border rounded-md flex items-center justify-between ${
                    editingRole.role === 'editor' 
                      ? 'bg-purple-50 border-purple-500 text-purple-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-black">Editor</span>
                  <span className="text-xs text-black">Can view and edit files</span>
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setEditingRole(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 