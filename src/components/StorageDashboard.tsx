import { useState, useEffect } from 'react';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { FiHardDrive, FiFile, FiImage, FiFileText, FiArchive, FiVideo, FiMusic, FiCode } from 'react-icons/fi';

interface StorageStats {
  totalSize: number;
  fileTypes: {
    [key: string]: {
      count: number;
      size: number;
    };
  };
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileTypeIcon = (type: string) => {
  if (type.startsWith('image/')) return <FiImage className="w-5 h-5" />;
  if (type.startsWith('text/')) return <FiFileText className="w-5 h-5" />;
  if (type.includes('zip') || type.includes('rar')) return <FiArchive className="w-5 h-5" />;
  if (type.startsWith('video/')) return <FiVideo className="w-5 h-5" />;
  if (type.startsWith('audio/')) return <FiMusic className="w-5 h-5" />;
  if (type.includes('javascript') || type.includes('typescript') || type.includes('html') || type.includes('css')) return <FiCode className="w-5 h-5" />;
  return <FiFile className="w-5 h-5" />;
};

const getFileTypeName = (type: string): string => {
  if (type.startsWith('image/')) return 'Images';
  if (type.startsWith('text/')) return 'Text Files';
  if (type.includes('zip') || type.includes('rar')) return 'Archives';
  if (type.startsWith('video/')) return 'Videos';
  if (type.startsWith('audio/')) return 'Audio Files';
  if (type.includes('javascript')) return 'JavaScript Files';
  if (type.includes('typescript')) return 'TypeScript Files';
  if (type.includes('html')) return 'HTML Files';
  if (type.includes('css')) return 'CSS Files';
  if (type.includes('pdf')) return 'PDF Documents';
  if (type.includes('word')) return 'Word Documents';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'Spreadsheets';
  if (type.includes('presentation')) return 'Presentations';
  return type.split('/')[1] || 'Other Files';
};

export default function StorageDashboard() {
  const [stats, setStats] = useState<StorageStats>({
    totalSize: 0,
    fileTypes: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateStorageStats = async () => {
      try {
        setLoading(true);
        const rootRef = ref(storage, 'files');
        const result = await listAll(rootRef);
        
        const fileStats: StorageStats = {
          totalSize: 0,
          fileTypes: {},
        };

        // Process all files in the root directory
        for (const item of result.items) {
          const metadata = await getMetadata(item);
          const fileType = metadata.contentType || 'unknown';
          const fileSize = metadata.size || 0;

          fileStats.totalSize += fileSize;

          if (!fileStats.fileTypes[fileType]) {
            fileStats.fileTypes[fileType] = {
              count: 0,
              size: 0,
            };
          }

          fileStats.fileTypes[fileType].count += 1;
          fileStats.fileTypes[fileType].size += fileSize;
        }

        // Process all subfolders recursively
        const processFolder = async (folderPath: string) => {
          const folderRef = ref(storage, folderPath);
          const folderResult = await listAll(folderRef);
          
          // Process files in this folder
          for (const item of folderResult.items) {
            const metadata = await getMetadata(item);
            const fileType = metadata.contentType || 'unknown';
            const fileSize = metadata.size || 0;

            fileStats.totalSize += fileSize;

            if (!fileStats.fileTypes[fileType]) {
              fileStats.fileTypes[fileType] = {
                count: 0,
                size: 0,
              };
            }

            fileStats.fileTypes[fileType].count += 1;
            fileStats.fileTypes[fileType].size += fileSize;
          }
          
          // Process subfolders
          for (const prefix of folderResult.prefixes) {
            await processFolder(prefix.fullPath);
          }
        };

        // Process all subfolders
        for (const prefix of result.prefixes) {
          await processFolder(prefix.fullPath);
        }

        setStats(fileStats);
      } catch (error) {
        console.error('Error calculating storage stats:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateStorageStats();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <FiHardDrive className="w-6 h-6 text-blue-500" />
        <h2 className="text-xl font-semibold text-black">Storage Dashboard</h2>
      </div>

      <div className="mb-6">
        <div className="text-sm text-gray-500 mb-1">Total Storage Used</div>
        <div className="text-2xl font-bold text-black">{formatBytes(stats.totalSize)}</div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-black">File Types</h3>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : Object.entries(stats.fileTypes).length > 0 ? (
          Object.entries(stats.fileTypes).map(([type, data]) => (
            <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getFileTypeIcon(type)}
                <div>
                  <div className="text-sm font-medium text-black">{getFileTypeName(type)}</div>
                  <div className="text-xs text-gray-500">{data.count} files</div>
                </div>
              </div>
              <div className="text-sm font-medium text-black">{formatBytes(data.size)}</div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">No files found</div>
        )}
      </div>
    </div>
  );
} 