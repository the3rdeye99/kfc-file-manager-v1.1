'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, uploadBytesResumable, listAll, getDownloadURL, deleteObject, UploadTaskSnapshot, UploadTask } from 'firebase/storage';
import { storage } from '@app/lib/firebase';
import { useAuth } from '@app/contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiTrash2, FiFolder, FiFolderPlus, FiGrid, FiList, FiSearch, FiEye, FiX, FiUpload } from 'react-icons/fi';
import Image from 'next/image';

interface FileItem {
  name: string;
  url: string;
  path: string;
  type: 'file' | 'folder';
  parentFolder: string;
}

// Helper function to check user permissions
const getUserPermissions = (email: string | null | undefined) => {
  if (!email) return { isAdmin: false };
  return {
    isAdmin: email === 'admin@kayodefilani.com',
  };
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

export default function FileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentFolder, setCurrentFolder] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const { user } = useAuth();
  const { isAdmin } = getUserPermissions(user?.email);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const lastUploadedBytes = useRef(0);
  const lastUpdateTime = useRef(Date.now());

  const loadFiles = useCallback(async () => {
    try {
      // If user is not logged in, don't try to load files
      if (!user) {
        setFiles([]);
        return;
      }

      const folderRef = ref(storage, currentFolder || 'files');
      const result = await listAll(folderRef);
      
      const filePromises = result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return {
          name: item.name,
          url,
          path: item.fullPath,
          type: 'file' as const,
          parentFolder: currentFolder
        };
      });

      const folderItems = result.prefixes.map(prefix => ({
        name: prefix.name,
        url: '',
        path: prefix.fullPath,
        type: 'folder' as const,
        parentFolder: currentFolder
      }));

      const files = await Promise.all(filePromises);
      setFiles([...folderItems, ...files]);
    } catch (error) {
      console.error('Error loading files:', error);
      // Only show error toast if user is logged in
      if (user) {
        toast.error('Failed to load files');
      }
      setFiles([]);
    }
  }, [currentFolder, user]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length || !isAdmin) return;
    
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining(0);
    lastUploadedBytes.current = 0;
    lastUpdateTime.current = Date.now();
    
    const file = event.target.files[0];
    setTotalSize(file.size);
    
    // Sanitize the file name to prevent path traversal
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = currentFolder ? `${currentFolder}/${sanitizedFileName}` : `files/${sanitizedFileName}`;
    const fileRef = ref(storage, filePath);

    try {
      const uploadTask: UploadTask = uploadBytesResumable(fileRef, file);
      uploadTask.on('state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const now = Date.now();
          const timeDiff = (now - lastUpdateTime.current) / 1000; // in seconds
          const bytesDiff = snapshot.bytesTransferred - lastUploadedBytes.current;
          
          // Calculate upload speed (bytes per second)
          const speed = bytesDiff / timeDiff;
          setUploadSpeed(speed);
          
          // Calculate time remaining
          const remainingBytes = snapshot.totalBytes - snapshot.bytesTransferred;
          const remainingTime = remainingBytes / speed;
          setTimeRemaining(remainingTime);
          
          // Update progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          
          // Update last values
          lastUploadedBytes.current = snapshot.bytesTransferred;
          lastUpdateTime.current = now;
        },
        (error: Error) => {
          console.error('Error uploading file:', error);
          toast.error('Failed to upload file');
        },
        async () => {
          toast.success('File uploaded successfully');
          setUploadProgress(0);
          setUploadSpeed(0);
          setTimeRemaining(0);
          setTotalSize(0);
          loadFiles();
        }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(0);
      setTotalSize(0);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }
    
    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      toast.success('File deleted successfully');
      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleFileClick = (file: FileItem) => {
    console.log('File clicked:', file);
    if (file.type === 'file') {
      console.log('Setting preview file:', file);
      setPreviewFile(file);
    }
  };

  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    console.log('File extension:', extension);
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  };

  const renderPreview = () => {
    console.log('Current preview file:', previewFile);
    if (!previewFile) return null;

    const fileType = getFileType(previewFile.name);
    console.log('File type:', fileType);
    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf';
    const isText = fileType === 'text/plain';

    console.log('Preview type:', { isImage, isPDF, isText });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold text-black">{previewFile.name}</h3>
            <button
              onClick={() => setPreviewFile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX size={24} />
            </button>
          </div>
          <div className="p-4 h-[calc(90vh-4rem)] overflow-auto">
            {isImage && (
              <Image
                src={previewFile.url}
                alt={previewFile.name}
                width={800}
                height={600}
              />
            )}
            {isPDF && (
              <iframe
                src={previewFile.url}
                className="w-full h-full"
                title={previewFile.name}
              />
            )}
            {isText && (
              <pre className="whitespace-pre-wrap font-mono text-sm text-black">
                {previewFile.url}
              </pre>
            )}
            {!isImage && !isPDF && !isText && (
              <div className="text-center py-8">
                <p className="text-gray-500">Preview not available for this file type</p>
                <a
                  href={previewFile.url}
                  download
                  className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Download to View
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const navigateToFolder = (path: string) => {
    setCurrentFolder(path);
  };

  const navigateUp = () => {
    const parentPath = currentFolder.split('/').slice(0, -1).join('/');
    setCurrentFolder(parentPath);
  };

  const filteredItems = files.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    // Sanitize the folder name to prevent path traversal
    const sanitizedFolderName = newFolderName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folderPath = currentFolder 
      ? `${currentFolder}/${sanitizedFolderName}/.placeholder`
      : `files/${sanitizedFolderName}/.placeholder`;

    try {
      // Create an empty file to represent the folder
      const placeholderRef = ref(storage, folderPath);
      await uploadBytesResumable(placeholderRef, new Uint8Array(0));
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowNewFolderInput(false);
      loadFiles();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) {
      return;
    }

    try {
      // List all items in the folder
      const folderRef = ref(storage, folderPath);
      const result = await listAll(folderRef);
      
      // Delete all files in the folder
      const deletePromises = result.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);
      
      // Delete all subfolders recursively
      const deleteFolderPromises = result.prefixes.map(prefix => handleDeleteFolder(prefix.fullPath));
      await Promise.all(deleteFolderPromises);
      
      // Finally delete the folder itself (the placeholder file)
      const placeholderPath = `${folderPath}/.placeholder`;
      const placeholderRef = ref(storage, placeholderPath);
      try {
        await deleteObject(placeholderRef);
      } catch {
        console.log('No placeholder file found, continuing...');
      }
      
      toast.success('Folder deleted successfully');
      loadFiles();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex flex-col space-y-4">
          {/* Navigation and Controls */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {currentFolder && (
                <button
                  onClick={navigateUp}
                  className="text-blue-500 hover:text-blue-600"
                >
                  ← Back
                </button>
              )}
              <h2 className="text-xl font-semibold text-black">
                {currentFolder || 'Root'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              {isAdmin && (
                <>
                  <input
                    type="file"
                    onChange={handleUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2"
                  >
                    <FiUpload />
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </label>
                  <button
                    onClick={() => setShowNewFolderInput(true)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <FiFolderPlus />
                    New Folder
                  </button>
                </>
              )}
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="text-gray-600 hover:text-gray-800"
                title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
              >
                {viewMode === 'grid' ? <FiList size={20} /> : <FiGrid size={20} />}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files and folders..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>

          {/* New Folder Input */}
          {showNewFolderInput && (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <button
                onClick={createFolder}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Files and Folders List/Grid */}
          <div className={`mt-4 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}`}>
            {filteredItems.map((item) => (
              <div
                key={item.path}
                className={`${
                  viewMode === 'grid'
                    ? 'bg-white p-4 rounded-lg flex flex-col items-center justify-center space-y-2 cursor-pointer hover:bg-gray-50 border border-gray-200'
                    : 'flex items-center justify-between p-4 bg-white rounded-lg cursor-pointer hover:bg-gray-50 border border-gray-200'
                }`}
                onClick={() => handleFileClick(item)}
              >
                <div className={`flex items-center ${viewMode === 'grid' ? 'flex-col text-center' : 'space-x-4'}`}>
                  {item.type === 'folder' ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToFolder(item.path);
                        }}
                        className="flex items-center space-x-2 text-blue-500 hover:text-blue-600"
                      >
                        <FiFolder size={24} />
                        <span className="text-black">{item.name}</span>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(item.path);
                          }}
                          className="p-2 text-red-500 hover:text-red-600"
                          title="Delete Folder"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="text-black truncate flex-1">{item.name}</span>
                      <div className="flex gap-2">
                        <span
                          className="p-2 text-gray-400"
                          title="View File"
                        >
                          <FiEye />
                        </span>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.path);
                            }}
                            className="p-2 text-red-500 hover:text-red-600"
                            title="Delete"
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <p className="text-center text-gray-500 py-4 col-span-full">
                {searchQuery ? 'No matching files and folders found' : 'No files and folders'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* File Preview Modal */}
      {renderPreview()}

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 w-80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Uploading...</span>
            <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatBytes(lastUploadedBytes.current)} / {formatBytes(totalSize)}</span>
            <span>{formatBytes(uploadSpeed)}/s</span>
            <span>{formatTime(timeRemaining)} remaining</span>
          </div>
        </div>
      )}
    </div>
  );
}