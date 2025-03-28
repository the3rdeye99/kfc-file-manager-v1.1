'use client';

import { useState, useEffect } from 'react';
import { FiClock, FiFile, FiFolder, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface FileAccess {
  id: string;
  filePath: string;
  userEmail: string;
  username: string;
  timestamp: string;
}

export default function FileAccessHistory() {
  const [accessHistory, setAccessHistory] = useState<FileAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccessHistory();
  }, []);

  const loadAccessHistory = async () => {
    try {
      const response = await fetch('/api/file-access');
      if (!response.ok) {
        throw new Error('Failed to fetch access history');
      }
      const data = await response.json();
      setAccessHistory(data.accessHistory);
    } catch (error) {
      console.error('Error loading access history:', error);
      toast.error('Failed to load access history');
    } finally {
      setLoading(false);
    }
  };

  const getFileType = (path: string) => {
    return path.endsWith('/') ? 'folder' : 'file';
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || 'Root';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FiClock className="text-blue-500" />
          File Access History
        </h2>
        <button
          onClick={loadAccessHistory}
          className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          <FiRefreshCw />
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Path
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accessHistory.map((access) => {
              const fileType = getFileType(access.filePath);
              const fileName = getFileName(access.filePath);
              return (
                <tr key={access.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {fileType === 'folder' ? (
                      <FiFolder className="text-blue-500" />
                    ) : (
                      <FiFile className="text-gray-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {fileName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {access.filePath}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {access.userEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {access.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(access.timestamp).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 