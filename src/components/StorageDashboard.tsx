import { useState, useEffect } from 'react';
import { ref, listAll, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { FiHardDrive, FiFile, FiImage, FiFileText, FiArchive, FiVideo, FiMusic, FiCode, FiFile as FiDocument, FiRefreshCw, FiChevronDown, FiChevronUp } from 'react-icons/fi';

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
  if (type.startsWith('image/') || type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('gif') || type.includes('webp')) 
    return <FiImage className="w-5 h-5 text-blue-500" />;
  if (type.startsWith('text/') || type.includes('txt') || type.includes('md')) 
    return <FiFileText className="w-5 h-5 text-green-500" />;
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar') || type.includes('gz')) 
    return <FiArchive className="w-5 h-5 text-yellow-500" />;
  if (type.startsWith('video/') || type.includes('mp4') || type.includes('avi') || type.includes('mov') || type.includes('wmv') || type.includes('flv') || type.includes('mkv')) 
    return <FiVideo className="w-5 h-5 text-purple-500" />;
  if (type.startsWith('audio/') || type.includes('mp3') || type.includes('wav') || type.includes('ogg') || type.includes('aac') || type.includes('flac') || type.includes('m4a')) 
    return <FiMusic className="w-5 h-5 text-pink-500" />;
  if (type.includes('javascript') || type.includes('js')) 
    return <FiCode className="w-5 h-5 text-yellow-600" />;
  if (type.includes('typescript') || type.includes('ts')) 
    return <FiCode className="w-5 h-5 text-blue-600" />;
  if (type.includes('html')) 
    return <FiCode className="w-5 h-5 text-orange-500" />;
  if (type.includes('css')) 
    return <FiCode className="w-5 h-5 text-blue-400" />;
  if (type.includes('pdf')) 
    return <FiDocument className="w-5 h-5 text-red-500" />;
  if (type.includes('word') || type.includes('docx') || type.includes('doc')) 
    return <FiDocument className="w-5 h-5 text-blue-600" />;
  if (type.includes('excel') || type.includes('xlsx') || type.includes('xls') || type.includes('spreadsheet')) 
    return <FiDocument className="w-5 h-5 text-green-600" />;
  if (type.includes('presentation') || type.includes('pptx') || type.includes('ppt')) 
    return <FiDocument className="w-5 h-5 text-orange-600" />;
  return <FiFile className="w-5 h-5 text-gray-500" />;
};

const getFileTypeName = (type: string): string => {
  if (type.startsWith('image/') || type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('gif') || type.includes('webp')) 
    return 'Images';
  if (type.startsWith('text/') || type.includes('txt') || type.includes('md')) 
    return 'Text Files';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar') || type.includes('gz')) 
    return 'Archives';
  if (type.startsWith('video/') || type.includes('mp4') || type.includes('avi') || type.includes('mov') || type.includes('wmv') || type.includes('flv') || type.includes('mkv')) 
    return 'Videos';
  if (type.startsWith('audio/') || type.includes('mp3') || type.includes('wav') || type.includes('ogg') || type.includes('aac') || type.includes('flac') || type.includes('m4a')) 
    return 'Audio Files';
  if (type.includes('javascript') || type.includes('js')) 
    return 'JavaScript Files';
  if (type.includes('typescript') || type.includes('ts')) 
    return 'TypeScript Files';
  if (type.includes('html')) 
    return 'HTML Files';
  if (type.includes('css')) 
    return 'CSS Files';
  if (type.includes('pdf')) 
    return 'PDF Documents';
  if (type.includes('word') || type.includes('docx') || type.includes('doc')) 
    return 'Word Documents';
  if (type.includes('excel') || type.includes('xlsx') || type.includes('xls') || type.includes('spreadsheet')) 
    return 'Spreadsheets';
  if (type.includes('presentation') || type.includes('pptx') || type.includes('ppt')) 
    return 'Presentations';
  return 'Other Files';
};

export default function StorageDashboard() {
  const [stats, setStats] = useState<StorageStats>({
    totalSize: 0,
    fileTypes: {},
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const calculateStorageStats = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      const rootRef = ref(storage, 'files');
      const result = await listAll(rootRef);
      
      const fileStats: StorageStats = {
        totalSize: 0,
        fileTypes: {},
      };

      // Process all files in the root directory
      for (const item of result.items) {
        const metadata = await getMetadata(item);
        let fileType = metadata.contentType || 'unknown';
        const fileSize = metadata.size || 0;
        
        // If content type is unknown or application/octet-stream, try to determine from file extension
        if (fileType === 'unknown' || fileType === 'application/octet-stream') {
          const extension = item.name.split('.').pop()?.toLowerCase() || '';
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            fileType = 'image/jpeg';
          } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(extension)) {
            fileType = 'video/mp4';
          } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) {
            fileType = 'audio/mpeg';
          } else if (['pdf'].includes(extension)) {
            fileType = 'application/pdf';
          } else if (['doc', 'docx'].includes(extension)) {
            fileType = 'application/msword';
          } else if (['xls', 'xlsx'].includes(extension)) {
            fileType = 'application/vnd.ms-excel';
          } else if (['ppt', 'pptx'].includes(extension)) {
            fileType = 'application/vnd.ms-powerpoint';
          } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
            fileType = 'application/zip';
          } else if (['txt', 'md'].includes(extension)) {
            fileType = 'text/plain';
          } else if (['js'].includes(extension)) {
            fileType = 'application/javascript';
          } else if (['ts'].includes(extension)) {
            fileType = 'application/typescript';
          } else if (['html', 'htm'].includes(extension)) {
            fileType = 'text/html';
          } else if (['css'].includes(extension)) {
            fileType = 'text/css';
          }
        }

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
          let fileType = metadata.contentType || 'unknown';
          const fileSize = metadata.size || 0;
          
          // If content type is unknown or application/octet-stream, try to determine from file extension
          if (fileType === 'unknown' || fileType === 'application/octet-stream') {
            const extension = item.name.split('.').pop()?.toLowerCase() || '';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
              fileType = 'image/jpeg';
            } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(extension)) {
              fileType = 'video/mp4';
            } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) {
              fileType = 'audio/mpeg';
            } else if (['pdf'].includes(extension)) {
              fileType = 'application/pdf';
            } else if (['doc', 'docx'].includes(extension)) {
              fileType = 'application/msword';
            } else if (['xls', 'xlsx'].includes(extension)) {
              fileType = 'application/vnd.ms-excel';
            } else if (['ppt', 'pptx'].includes(extension)) {
              fileType = 'application/vnd.ms-powerpoint';
            } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
              fileType = 'application/zip';
            } else if (['txt', 'md'].includes(extension)) {
              fileType = 'text/plain';
            } else if (['js'].includes(extension)) {
              fileType = 'application/javascript';
            } else if (['ts'].includes(extension)) {
              fileType = 'application/typescript';
            } else if (['html', 'htm'].includes(extension)) {
              fileType = 'text/html';
            } else if (['css'].includes(extension)) {
              fileType = 'text/css';
            }
          }

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
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    calculateStorageStats();
  };

  useEffect(() => {
    calculateStorageStats();

    // Listen for file operation events
    const handleFileOperation = () => {
      console.log('File operation detected, refreshing storage stats');
      calculateStorageStats();
    };

    // Add event listeners for file operations
    window.addEventListener('fileUploaded', handleFileOperation);
    window.addEventListener('fileDeleted', handleFileOperation);
    window.addEventListener('folderCreated', handleFileOperation);
    window.addEventListener('filesDeleted', handleFileOperation);

    // Cleanup event listeners
    return () => {
      window.removeEventListener('fileUploaded', handleFileOperation);
      window.removeEventListener('fileDeleted', handleFileOperation);
      window.removeEventListener('folderCreated', handleFileOperation);
      window.removeEventListener('filesDeleted', handleFileOperation);
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiHardDrive className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-black">Storage Dashboard</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="Refresh storage stats"
          >
            <FiRefreshCw className={`w-4 h-4 text-blue-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title={isExpanded ? "Hide details" : "Show details"}
          >
            {isExpanded ? (
              <FiChevronUp className="w-4 h-4 text-blue-500" />
            ) : (
              <FiChevronDown className="w-4 h-4 text-blue-500" />
            )}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-0.5">Total Storage Used</div>
        <div className="text-xl font-bold text-black">{formatBytes(stats.totalSize)}</div>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-black">File Types</h3>
          {loading ? (
            <div className="flex justify-center py-2">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : Object.entries(stats.fileTypes).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(stats.fileTypes).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {getFileTypeIcon(type)}
                    <div>
                      <div className="text-xs font-medium text-black">{getFileTypeName(type)}</div>
                      <div className="text-xs text-gray-500">{data.count} files</div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-black">{formatBytes(data.size)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-2 text-gray-500 text-xs">No files found</div>
          )}
        </div>
      )}
    </div>
  );
} 