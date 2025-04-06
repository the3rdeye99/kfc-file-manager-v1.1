"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FaTrash, FaUndo, FaExclamationTriangle, FaArrowLeft, FaCheckSquare, FaSquare, FaCheck } from 'react-icons/fa';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface TrashItem {
  id: string;
  filePath: string;
  fileName: string;
  fileType: string;
  deletedAt: {
    seconds: number;
    nanoseconds: number;
  };
  expiresAt: {
    seconds: number;
    nanoseconds: number;
  };
  username: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function TrashBin() {
  const { user } = useAuth();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/users/current');
        if (response.ok) {
          const userData = await response.json();
          setUserRole(userData.role || 'viewer');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    if (user) {
      fetchUserRole();
    }
  }, [user]);

  // Check if user is admin
  const isAdmin = user?.email === 'admin@kayodefilani.com';

  const fetchTrashItems = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/trash?page=${page}&limit=${limit}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch trash items');
      }
      
      setTrashItems(data.trashItems);
      setPagination({
        total: data.total,
        page: data.page,
        limit: data.limit,
        totalPages: data.totalPages
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTrashItems();
    }
  }, [user]);

  const handleDelete = async (trashId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this item? This action cannot be undone and the file cannot be restored.')) {
      return;
    }
    
    try {
      setDeleting(trashId);
      const response = await fetch(`/api/trash?id=${trashId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete item');
      }
      
      // Refresh the trash items
      fetchTrashItems(pagination.page, pagination.limit);
      
      // Show success message
      toast.success('Item permanently deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      toast.error('Failed to delete item');
    } finally {
      setDeleting(null);
    }
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (!isMultiSelectMode) {
      setSelectedItems([]);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedItems.length} item(s)? This action cannot be undone and the files cannot be restored.`)) {
      return;
    }
    
    try {
      setBulkDeleting(true);
      
      const deletePromises = selectedItems.map(async (itemId) => {
        const response = await fetch(`/api/trash?id=${itemId}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `Failed to delete item ${itemId}`);
        }
        
        return data;
      });
      
      await Promise.all(deletePromises);
      
      // Refresh the trash items
      fetchTrashItems(pagination.page, pagination.limit);
      setSelectedItems([]);
      setIsMultiSelectMode(false);
      
      // Show success message
      toast.success(`${selectedItems.length} item(s) permanently deleted`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete items');
      toast.error('Failed to delete some items');
    } finally {
      setBulkDeleting(false);
    }
  };

  const formatDate = (timestamp: { seconds: number; nanoseconds: number }) => {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  const getDaysRemaining = (expiresAt: { seconds: number; nanoseconds: number }) => {
    const now = new Date();
    const expiryDate = new Date(expiresAt.seconds * 1000);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Add a function to select all items
  const handleSelectAll = () => {
    if (selectedItems.length === trashItems.length) {
      // If all items are already selected, deselect all
      setSelectedItems([]);
    } else {
      // Otherwise, select all items
      setSelectedItems(trashItems.map(item => item.id));
    }
  };

  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/" className="flex items-center text-black hover:text-blue-600 transition-colors mr-4">
            <FaArrowLeft className="mr-2" />
            <span>Back to Files</span>
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <FaExclamationTriangle className="text-yellow-500 text-4xl mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-black mb-2">Access Denied</h2>
          <p className="text-gray-600">Only administrators can access the trash bin.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <FaExclamationTriangle className="text-red-500 text-4xl" />
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => fetchTrashItems(pagination.page, pagination.limit)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Link href="/" className="flex items-center text-black hover:text-blue-600 transition-colors mr-4">
          <FaArrowLeft className="mr-2" />
          <span>Back to Files</span>
        </Link>
        <h1 className="text-2xl font-bold text-black">Trash Bin</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center">
            <button
              onClick={toggleMultiSelectMode}
              className={`p-2 ${isMultiSelectMode ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'} rounded-lg`}
              title={isMultiSelectMode ? "Exit multi-select mode" : "Select multiple items"}
            >
              {isMultiSelectMode ? <FaCheckSquare className="w-5 h-5" /> : <FaSquare className="w-5 h-5" />}
            </button>
            {isMultiSelectMode && (
              <span className="ml-2 text-sm text-gray-600">Select multiple files</span>
            )}
          </div>
          {isMultiSelectMode && (
            <>
              <div className="flex items-center">
                <button
                  onClick={handleSelectAll}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                  title={selectedItems.length === trashItems.length ? "Deselect all" : "Select all"}
                >
                  {selectedItems.length === trashItems.length ? (
                    <FaCheckSquare className="w-5 h-5" />
                  ) : (
                    <FaSquare className="w-5 h-5" />
                  )}
                </button>
                <span className="ml-2 text-sm text-gray-600">
                  {selectedItems.length === trashItems.length ? "Deselect all" : "Select all"}
                </span>
              </div>
              {selectedItems.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Delete ${selectedItems.length} selected item(s)`}
                >
                  {bulkDeleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                  ) : (
                    <FaTrash className="w-5 h-5" />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {trashItems.length === 0 ? (
        <div className="text-center py-8">
          <FaTrash className="text-gray-400 text-5xl mx-auto mb-4" />
          <p className="text-black">The trash bin is empty</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isMultiSelectMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                      Select
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Deleted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Deleted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Expires In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trashItems.map((item) => (
                  <tr key={item.id} className={selectedItems.includes(item.id) ? 'bg-blue-50' : ''}>
                    {isMultiSelectMode && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleItemSelection(item.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {selectedItems.includes(item.id) ? (
                            <FaCheckSquare className="w-5 h-5" />
                          ) : (
                            <FaSquare className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{item.fileName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{item.fileType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{item.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{formatDate(item.deletedAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {getDaysRemaining(item.expiresAt)} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting === item.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                        ) : (
                          <FaTrash className="text-lg" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center space-x-2">
              <button
                onClick={() => fetchTrashItems(pagination.page - 1, pagination.limit)}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-gray-200 text-black rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-black">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchTrashItems(pagination.page + 1, pagination.limit)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 bg-gray-200 text-black rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 