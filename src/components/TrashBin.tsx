"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FaTrash, FaUndo, FaExclamationTriangle, FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';

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

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-black">Please log in to view the trash bin.</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Deleted By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Deleted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Expires In</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trashItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{item.fileName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{item.fileType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{item.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{formatDate(item.deletedAt)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {getDaysRemaining(item.expiresAt)} days
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