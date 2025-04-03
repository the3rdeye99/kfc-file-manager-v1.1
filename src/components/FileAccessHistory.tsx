'use client';

import { useState, useEffect } from 'react';
import { FiClock, FiUser, FiFile, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface FileAccess {
  id: string;
  filePath: string;
  userId: string;
  userEmail: string;
  username: string;
  timestamp: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function FileAccessHistory() {
  const [accessHistory, setAccessHistory] = useState<FileAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  });

  const fetchAccessHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/file-access?page=${pagination.page}&limit=${pagination.limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch access history');
      }
      const data = await response.json();
      setAccessHistory(data.accessHistory);
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
    fetchAccessHistory();
  }, [pagination.page, pagination.limit]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">File Access History</h2>
      
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <label htmlFor="itemsPerPage" className="text-gray-900">Items per page:</label>
          <select
            id="itemsPerPage"
            value={pagination.limit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="border rounded px-2 py-1 text-gray-900"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        
        <div className="text-gray-900">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-gray-900">File</th>
              <th className="text-left py-3 px-4 text-gray-900">User</th>
              <th className="text-left py-3 px-4 text-gray-900">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {accessHistory.map((access) => (
              <tr key={access.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2 text-gray-900">
                    <FiFile className="text-gray-900" />
                    <span>{access.filePath}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2 text-gray-900">
                    <FiUser className="text-gray-900" />
                    <span>{access.username}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2 text-gray-900">
                    <FiClock className="text-gray-900" />
                    <span>{new Date(access.timestamp).toLocaleString()}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => handlePageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
          className="flex items-center space-x-1 px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed text-gray-900"
        >
          <FiChevronLeft className="text-gray-900" />
          <span>Previous</span>
        </button>
        
        <div className="text-gray-900">
          Page {pagination.page} of {pagination.totalPages}
        </div>
        
        <button
          onClick={() => handlePageChange(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
          className="flex items-center space-x-1 px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed text-gray-900"
        >
          <span>Next</span>
          <FiChevronRight className="text-gray-900" />
        </button>
      </div>
    </div>
  );
} 