'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, uploadBytesResumable, listAll, getDownloadURL, deleteObject, UploadTaskSnapshot, UploadTask, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiTrash2, FiFolder, FiFolderPlus, FiGrid, FiList, FiSearch, FiEye, FiX, FiUpload, FiRefreshCw, FiFile, FiImage, FiFileText, FiArchive, FiVideo, FiMusic, FiCode, FiEdit2, FiSave } from 'react-icons/fi';
import Image from 'next/image';
import StorageDashboard from './StorageDashboard';

interface FileItem {
  name: string;
  url: string;
  path: string;
  type: 'file' | 'folder';
  parentFolder: string;
  size?: number;
  lastModified?: number;
  category?: 'includes_coo' | 'without_coo';
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

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return <FiImage className="w-5 h-5 text-blue-500" />;
    case 'pdf':
      return <FiFileText className="w-5 h-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FiFileText className="w-5 h-5 text-blue-600" />;
    case 'xls':
    case 'xlsx':
      return <FiFileText className="w-5 h-5 text-green-500" />;
    case 'ppt':
    case 'pptx':
      return <FiFileText className="w-5 h-5 text-orange-500" />;
    case 'zip':
    case 'rar':
    case '7z':
      return <FiArchive className="w-5 h-5 text-yellow-500" />;
    case 'mp4':
    case 'avi':
    case 'mov':
      return <FiVideo className="w-5 h-5 text-purple-500" />;
    case 'mp3':
    case 'wav':
    case 'ogg':
      return <FiMusic className="w-5 h-5 text-pink-500" />;
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'html':
    case 'css':
      return <FiCode className="w-5 h-5 text-gray-700" />;
    default:
      return <FiFile className="w-5 h-5 text-gray-500" />;
  }
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'includes_coo' | 'without_coo'>('all');
  const [newFolderCategory, setNewFolderCategory] = useState<'includes_coo' | 'without_coo'>('includes_coo');

  const loadFiles = useCallback(async () => {
    try {
      // If user is not logged in, don't try to load files
      if (!user) {
        setFiles([]);
        return;
      }

      setIsRefreshing(true);
      // Always ensure we're within the 'files/' directory
      const folderPath = currentFolder ? `files/${currentFolder}` : 'files';
      const folderRef = ref(storage, folderPath);
      const result = await listAll(folderRef);
      
      const filePromises = result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        const metadata = await getMetadata(item);
        return {
          name: item.name,
          url,
          path: item.fullPath,
          type: 'file' as const,
          parentFolder: currentFolder,
          size: metadata.size,
          lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
          category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo'
        };
      });

      const folderItems = result.prefixes.map(async (prefix) => {
        const metadata = await getMetadata(ref(storage, `${prefix.fullPath}/.placeholder`));
        return {
        name: prefix.name,
        url: '',
        path: prefix.fullPath,
        type: 'folder' as const,
          parentFolder: currentFolder,
          category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo'
        };
      });

      const files = await Promise.all(filePromises);
      const folders = await Promise.all(folderItems);
      setFiles([...folders, ...files]);
    } catch (error) {
      console.error('Error loading files:', error);
      if (user) {
        toast.error('Failed to load files');
      }
      setFiles([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentFolder, user]);

  // Load all files for global search
  const loadAllFiles = useCallback(async () => {
    try {
      setIsSearching(true);
      const rootRef = ref(storage, 'files');
      const allItems: FileItem[] = [];
      
      const loadFolderContents = async (folderPath: string) => {
        // Ensure we're always within the 'files/' directory
        if (!folderPath.startsWith('files/')) {
          folderPath = `files/${folderPath}`;
        }
        
        const folderRef = ref(storage, folderPath);
        const result = await listAll(folderRef);
        
        // Process files in current folder
        const filePromises = result.items.map(async (item) => {
          const url = await getDownloadURL(item);
          const metadata = await getMetadata(item);
          return {
            name: item.name,
            url,
            path: item.fullPath,
            type: 'file' as const,
            parentFolder: folderPath.replace('files/', ''),
            size: metadata.size,
            lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
            category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo'
          };
        });
        
        const files = await Promise.all(filePromises);
        allItems.push(...files);
        
        // Process subfolders recursively
        const folderPromises = result.prefixes.map(async (prefix) => {
          try {
            // Try to get metadata from the placeholder file
            const placeholderRef = ref(storage, `${prefix.fullPath}/.placeholder`);
            let metadata;
            try {
              metadata = await getMetadata(placeholderRef);
            } catch (error) {
              // If placeholder doesn't exist, create a default metadata
              metadata = { customMetadata: { category: 'includes_coo' } };
            }
            
            const folderItem = {
              name: prefix.name,
              url: '',
              path: prefix.fullPath,
              type: 'folder' as const,
              parentFolder: folderPath.replace('files/', ''),
              category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo'
            };
            allItems.push(folderItem);
            await loadFolderContents(prefix.fullPath);
          } catch (error) {
            console.error(`Error processing folder ${prefix.fullPath}:`, error);
            // Continue with other folders even if one fails
            await loadFolderContents(prefix.fullPath);
          }
        });
        
        await Promise.all(folderPromises);
      };
      
      await loadFolderContents('files');
      setAllFiles(allItems);
      console.log('Loaded all files for search:', allItems.length);
    } catch (error) {
      console.error('Error loading all files for search:', error);
      toast.error('Failed to load files for search');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Load files when component mounts and when currentFolder changes
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Load all files for search when component mounts
  useEffect(() => {
    loadAllFiles();
  }, [loadAllFiles]);

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      console.log('Searching for:', query);
      console.log('All files count:', allFiles.length);
      
      // First try to find matches in the current directory
      const currentDirMatches = files.filter(item => 
        item.name.toLowerCase().includes(query)
      );
      
      // Then find matches in all files and folders recursively
      const allMatches = allFiles.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const pathMatch = item.path.toLowerCase().includes(query);
        const parentMatch = item.parentFolder.toLowerCase().includes(query);
        
        // For folders, also check if any of their contents match
        if (item.type === 'folder') {
          const folderContents = allFiles.filter(file => 
            file.path.startsWith(item.path + '/') && 
            (file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query))
          );
          return nameMatch || pathMatch || parentMatch || folderContents.length > 0;
        }
        
        return nameMatch || pathMatch || parentMatch;
      });
      
      // Combine results, prioritizing current directory matches
      const results = [...currentDirMatches, ...allMatches.filter(item => 
        !currentDirMatches.some(match => match.path === item.path)
      )];
      
      console.log('Search results count:', results.length);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, allFiles, files]);

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
    // Always ensure we're within the 'files/' directory
    const filePath = currentFolder ? `files/${currentFolder}/${sanitizedFileName}` : `files/${sanitizedFileName}`;
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
      // Ensure we're within the 'files/' directory
      const safeFilePath = filePath.startsWith('files/') ? filePath : `files/${filePath}`;
      const fileRef = ref(storage, safeFilePath);
      await deleteObject(fileRef);
      toast.success('File deleted successfully');
      loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleFileClick = async (file: FileItem) => {
    if (file.type === 'folder') {
      handleFolderClick(file);
    } else {
      try {
        // Record file access
        await fetch('/api/file-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filePath: file.path }),
        });

        // Set the file for preview
        setPreviewFile(file);
      } catch (error) {
        console.error('Error accessing file:', error);
        toast.error('Failed to access file');
      }
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

  const handleRename = async (item: FileItem, newName: string) => {
    if (!isAdmin) return;
    
    try {
      if (item.type === 'folder') {
        // For folders, we need to rename the placeholder file
        const oldPlaceholderPath = `${item.path}/.placeholder`;
        const newPlaceholderPath = `${item.parentFolder}/${newName}/.placeholder`;
        
        // Ensure we're within the 'files/' directory
        const safeOldPath = oldPlaceholderPath.startsWith('files/') ? oldPlaceholderPath : `files/${oldPlaceholderPath}`;
        const safeNewPath = newPlaceholderPath.startsWith('files/') ? newPlaceholderPath : `files/${newPlaceholderPath}`;
        
        // Create new placeholder
        const newPlaceholderRef = ref(storage, safeNewPath);
        await uploadBytesResumable(newPlaceholderRef, new Uint8Array(0));
        
        // Delete old placeholder
        const oldPlaceholderRef = ref(storage, safeOldPath);
        await deleteObject(oldPlaceholderRef);
        
        // Move all contents to new folder
        const folderRef = ref(storage, safeOldPath.replace('/.placeholder', ''));
        const result = await listAll(folderRef);
        
        // Move all files
        const movePromises = result.items.map(async (file) => {
          const newPath = file.fullPath.replace(item.path, `${item.parentFolder}/${newName}`);
          const safeNewPath = newPath.startsWith('files/') ? newPath : `files/${newPath}`;
          const newRef = ref(storage, safeNewPath);
          const url = await getDownloadURL(file);
          const response = await fetch(url);
          const blob = await response.blob();
          await uploadBytesResumable(newRef, blob);
          await deleteObject(file);
        });
        
        await Promise.all(movePromises);
        
        // Move all subfolders recursively
        const moveFolderPromises = result.prefixes.map(prefix => 
          handleRename(
            { 
              ...prefix,
              type: 'folder',
              url: '',
              parentFolder: item.parentFolder,
              path: prefix.fullPath
            },
            prefix.name
          )
        );
        await Promise.all(moveFolderPromises);
      } else {
        // For files, we can simply rename them
        const newPath = `${item.parentFolder}/${newName}`;
        // Ensure we're within the 'files/' directory
        const safeNewPath = newPath.startsWith('files/') ? newPath : `files/${newPath}`;
        const safeOldPath = item.path.startsWith('files/') ? item.path : `files/${item.path}`;
        
        const newRef = ref(storage, safeNewPath);
        const url = await getDownloadURL(ref(storage, safeOldPath));
        const response = await fetch(url);
        const blob = await response.blob();
        await uploadBytesResumable(newRef, blob);
        await deleteObject(ref(storage, safeOldPath));
      }
      
      toast.success('Item renamed successfully');
      setEditingItem(null);
      setNewName('');
      loadFiles();
    } catch (error) {
      console.error('Error renaming item:', error);
      toast.error('Failed to rename item');
    }
  };

  const handleEditContent = async (file: FileItem) => {
    if (!isAdmin) return;
    
    try {
      const response = await fetch(file.url);
      const text = await response.text();
      setEditingContent(text);
      setIsEditingContent(true);
      setPreviewFile(file);
    } catch (error) {
      console.error('Error loading file content:', error);
      toast.error('Failed to load file content');
    }
  };

  const handleSaveContent = async () => {
    if (!previewFile || !isAdmin) return;
    
    try {
      // Ensure we're within the 'files/' directory
      const safeFilePath = previewFile.path.startsWith('files/') ? previewFile.path : `files/${previewFile.path}`;
      const fileRef = ref(storage, safeFilePath);
      const blob = new Blob([editingContent], { type: 'text/plain' });
      await uploadBytesResumable(fileRef, blob);
      toast.success('File saved successfully');
      setIsEditingContent(false);
      setEditingContent('');
      loadFiles();
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error('Failed to save file');
    }
  };

  const renderPreview = () => {
    if (!previewFile) return null;

    const fileType = getFileType(previewFile.name);
    const isImage = fileType.startsWith('image/');
    const isPDF = fileType === 'application/pdf';
    const isText = fileType === 'text/plain';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold text-black">{previewFile.name}</h3>
            <div className="flex items-center gap-2">
              {isAdmin && isText && (
                <button
                  onClick={() => setIsEditingContent(!isEditingContent)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  {isEditingContent ? 'Preview' : 'Edit'}
                </button>
              )}
            <button
                onClick={() => {
                  setPreviewFile(null);
                  setIsEditingContent(false);
                  setEditingContent('');
                }}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX size={24} />
            </button>
            </div>
          </div>
          <div className="p-4 h-[calc(90vh-4rem)] overflow-auto">
            {isEditingContent ? (
              <div className="h-full flex flex-col">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="flex-1 w-full p-2 border rounded font-mono text-sm text-black"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveContent}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const navigateToFolder = (path: string) => {
    // Ensure we're within the 'files/' directory
    const safePath = path.startsWith('files/') ? path.replace('files/', '') : path;
    setCurrentFolder(safePath);
  };

  const navigateUp = async () => {
    try {
      // If we're already at the root of 'files/', don't navigate up
      if (!currentFolder) {
        return;
      }
      
      const parentPath = currentFolder.split('/').slice(0, -1).join('/');
      // Record folder access
      await fetch('/api/file-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: parentPath || 'files' }),
      });
      setCurrentFolder(parentPath);
    } catch (error) {
      console.error('Error navigating up:', error);
      toast.error('Failed to navigate up');
    }
  };

  // Define filteredItems based on whether we're searching or not and category filter
  const filteredItems = (searchQuery ? searchResults : files).filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    // Always ensure we're within the 'files/' directory
    const folderPath = currentFolder 
      ? `files/${currentFolder}/${newFolderName}/.placeholder`
      : `files/${newFolderName}/.placeholder`;

    try {
      // Create an empty file to represent the folder
      const placeholderRef = ref(storage, folderPath);
      const metadata = {
        customMetadata: {
          category: newFolderCategory
        }
      };
      await uploadBytesResumable(placeholderRef, new Uint8Array(0), metadata);
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
      // Ensure we're within the 'files/' directory
      const safeFolderPath = folderPath.startsWith('files/') ? folderPath : `files/${folderPath}`;
      
      // List all items in the folder
      const folderRef = ref(storage, safeFolderPath);
      const result = await listAll(folderRef);
      
      // Delete all files in the folder
      const deletePromises = result.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);
      
      // Delete all subfolders recursively
      const deleteFolderPromises = result.prefixes.map(prefix => handleDeleteFolder(prefix.fullPath));
      await Promise.all(deleteFolderPromises);
      
      // Finally delete the folder itself (the placeholder file)
      const placeholderPath = `${safeFolderPath}/.placeholder`;
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

  const handleFolderClick = async (folder: FileItem) => {
    try {
      // Record folder access
      await fetch('/api/file-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: folder.path }),
      });

      // Ensure we're within the 'files/' directory
      const safePath = folder.path.startsWith('files/') ? folder.path.replace('files/', '') : folder.path;
      setCurrentFolder(safePath);
    } catch (error) {
      console.error('Error accessing folder:', error);
      toast.error('Failed to access folder');
    }
  };

  const handleRefresh = () => {
    loadFiles();
    loadAllFiles(); // Also refresh the global search index
    if (searchQuery) {
      // Re-run search with current query
      const query = searchQuery.toLowerCase();
      const results = allFiles.filter(item => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const pathMatch = item.path.toLowerCase().includes(query);
        const parentMatch = item.parentFolder.toLowerCase().includes(query);
        
        // For folders, also check if any of their contents match
        if (item.type === 'folder') {
          const folderContents = allFiles.filter(file => 
            file.path.startsWith(item.path + '/') && 
            (file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query))
          );
          return nameMatch || pathMatch || parentMatch || folderContents.length > 0;
        }
        
        return nameMatch || pathMatch || parentMatch;
      });
      setSearchResults(results);
    }
  };

  return (
    <div className="flex gap-6 p-6">
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-black">File Manager</h1>
              {currentFolder && (
                <button
                  onClick={navigateUp}
                  className="text-blue-500 hover:text-blue-600"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as 'all' | 'includes_coo' | 'without_coo')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="all">All Files</option>
                  <option value="includes_coo">Includes C of O</option>
                  <option value="without_coo">Without C of O</option>
                </select>
              </div>
              <button
                onClick={handleRefresh}
                className={`p-2 rounded ${isRefreshing ? 'bg-blue-100 text-blue-600 animate-spin' : 'text-gray-500 hover:text-gray-700'}`}
                disabled={isRefreshing}
                title="Refresh files"
              >
                <FiRefreshCw className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <FiGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <FiList className="w-5 h-5" />
                </button>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNewFolderInput(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    <FiFolderPlus className="w-5 h-5" />
                    New Folder
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer">
                    <FiUpload className="w-5 h-5" />
                    Upload File
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files and folders..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-500">
              Searching all folders for "{searchQuery}"...
            </div>
          )}
          {showNewFolderInput && (
            <div className="flex items-center space-x-2 mt-4">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <select
                value={newFolderCategory}
                onChange={(e) => setNewFolderCategory(e.target.value as 'includes_coo' | 'without_coo')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="includes_coo">Includes C of O</option>
                <option value="without_coo">Without C of O</option>
              </select>
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
          <div className={`mt-4 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}`}>
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
              <div
                key={item.path}
                className={`${
                  viewMode === 'grid'
                      ? 'p-4 border rounded-lg hover:bg-gray-50 cursor-pointer relative'
                      : 'p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between'
                }`}
                onClick={() => handleFileClick(item)}
              >
                  <div className={`flex ${viewMode === 'list' ? 'items-center gap-3' : 'flex-col items-center'}`}>
                  {item.type === 'folder' ? (
                      <FiFolder className={`${viewMode === 'grid' ? 'w-12 h-12 mb-2' : 'w-6 h-6'} text-blue-500`} />
                    ) : (
                      <div className={`${viewMode === 'grid' ? 'w-12 h-12 mb-2' : 'w-6 h-6'} flex items-center justify-center`}>
                        {getFileIcon(item.name)}
                      </div>
                    )}
                    <div className={viewMode === 'grid' ? 'text-center' : ''}>
                      {editingItem?.path === item.path ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="px-2 py-1 border rounded text-black"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRename(item, newName);
                            }}
                            className="text-green-500 hover:text-green-600"
                          >
                            <FiSave className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem(null);
                              setNewName('');
                            }}
                            className="text-red-500 hover:text-red-600"
                          >
                            <FiX className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className={`font-medium text-black ${item.type === 'folder' ? '' : 'truncate max-w-[150px]'}`}>
                          {item.name}
                        </div>
                      )}
                      {item.size !== undefined && (
                        <div className="text-xs text-gray-500">{formatBytes(item.size)}</div>
                      )}
                      {item.lastModified && (
                        <div className="text-xs text-gray-500">
                          {new Date(item.lastModified).toLocaleDateString()}
                        </div>
                      )}
                      {searchQuery && (
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {item.path}
                        </div>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'absolute top-2 right-2' : ''}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setNewName(item.name);
                        }}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <FiEdit2 className="w-5 h-5" />
                      </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          if (item.type === 'folder') {
                            handleDeleteFolder(item.path);
                          } else {
                            handleDelete(item.path);
                          }
                          }}
                        className="text-red-500 hover:text-red-700"
                        >
                        <FiTrash2 className="w-5 h-5" />
                        </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4 col-span-full">
                {searchQuery ? 'No matching files and folders found' : 'No files and folders'}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="w-80">
        <StorageDashboard />
      </div>
      {renderPreview()}
    </div>
  );
}