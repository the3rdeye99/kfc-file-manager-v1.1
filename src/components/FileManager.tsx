'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, uploadBytesResumable, listAll, getDownloadURL, deleteObject, UploadTaskSnapshot, UploadTask, getMetadata, getBlob } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiTrash2, FiFolder, FiFolderPlus, FiGrid, FiList, FiSearch, FiEye, FiX, FiUpload, FiRefreshCw, FiFile, FiImage, FiFileText, FiArchive, FiVideo, FiMusic, FiCode, FiEdit2, FiSave, FiDownload, FiCheckSquare, FiSquare } from 'react-icons/fi';
import Image from 'next/image';
import { collection, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface FileItem {
  name: string;
  url: string;
  path: string;
  type: 'file' | 'folder';
  parentFolder: string;
  size?: number;
  lastModified?: number;
  category?: 'includes_coo' | 'without_coo';
  createdAt?: number;
}

// Helper function to check user permissions
const getUserPermissions = (email: string | null | undefined, role?: string) => {
  if (!email) return { isAdmin: false, canDownload: false };
  
  // Admin has all permissions
  if (email === 'admin@kayodefilani.com') {
    return { isAdmin: true, canDownload: true };
  }
  
  // Check role-based permissions
  if (role === 'editor') {
    return { isAdmin: false, canDownload: true };
  }
  
  // Default to viewer permissions
  return { isAdmin: false, canDownload: false };
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

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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
  const [userRole, setUserRole] = useState<string>('viewer');
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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showNewSubFolderModal, setShowNewSubFolderModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FileItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  const retryOperation = async (operation: () => Promise<any>, retries = MAX_RETRIES): Promise<any> => {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        console.log(`Operation failed, retrying... (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return retryOperation(operation, retries - 1);
      }
      throw error;
    }
  };

  const loadFiles = useCallback(async () => {
    try {
      if (isRefreshing) return;
      
      setIsRefreshing(true);
      const currentPath = currentFolder === 'root' ? 'files' : `files/${currentFolder}`;
      const folderRef = ref(storage, currentPath);
      
      // List all files and folders
      const result = await listAll(folderRef);
      
      // Process files
      const filePromises = result.items.map(async (item) => {
        try {
          const url = await getDownloadURL(item);
          const metadata = await getMetadata(item);
          
          // Get the folder's category if available
          let folderCategory: 'includes_coo' | 'without_coo' = 'includes_coo';
          if (currentFolder) {
            const placeholderRef = ref(storage, `files/${currentFolder}/.placeholder`);
            try {
              const folderMetadata = await getMetadata(placeholderRef);
              folderCategory = (folderMetadata.customMetadata?.category as 'includes_coo' | 'without_coo') || 'includes_coo';
            } catch (error) {
              console.error('Error getting folder category:', error);
            }
          }
          
          const fileItem: FileItem = {
            name: item.name,
            path: item.fullPath,
            url,
            type: 'file',
            size: metadata.size,
            parentFolder: currentFolder,
            lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
            category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo' || folderCategory
          };
          return fileItem;
        } catch (error) {
          console.error('Error processing file:', error);
          return null;
        }
      });
      
      // Process folders (items ending with .placeholder)
      const folderPromises = result.prefixes.map(async (prefix) => {
        try {
          // Check if this is a real folder by looking for .placeholder
          const placeholderRef = ref(storage, `${prefix.fullPath}/.placeholder`);
          try {
            const metadata = await getMetadata(placeholderRef);
            const folderItem: FileItem = {
              name: prefix.name,
              path: prefix.fullPath,
              url: '',
              type: 'folder',
              parentFolder: currentFolder,
              category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo',
              createdAt: metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : undefined,
              lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined
            };
            return folderItem;
          } catch (error) {
            // If .placeholder doesn't exist, this might be a file with a path separator
            return null;
          }
        } catch (error) {
          console.error('Error processing folder:', error);
          return null;
        }
      });
      
      const [files, folders] = await Promise.all([
        Promise.all(filePromises),
        Promise.all(folderPromises)
      ]);
      
      const validFiles = files.filter((file): file is FileItem => file !== null);
      const validFolders = folders.filter((folder): folder is FileItem => folder !== null);
      
      setFiles([...validFolders, ...validFiles]);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentFolder]);

  const debouncedLoadFiles = useCallback(
    debounce(() => {
      loadFiles();
    }, 500),
    [loadFiles]
  );

  useEffect(() => {
    debouncedLoadFiles();
    return () => {
      debounce(() => {}, 0)();
    };
  }, [debouncedLoadFiles]);

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
              category: metadata.customMetadata?.category as 'includes_coo' | 'without_coo',
              createdAt: metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : undefined,
              lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining(0);
      setTotalSize(0);
    lastUploadedBytes.current = 0;
    lastUpdateTime.current = Date.now();
    
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          // Sanitize the filename to prevent path traversal but preserve spaces
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9 .-]/g, '_');
          
          // Always ensure we're within the 'files/' directory
          const filePath = currentFolder ? `files/${currentFolder}/${sanitizedFileName}` : `files/${sanitizedFileName}`;
    const fileRef = ref(storage, filePath);

          // Get the current folder's category
          let folderCategory: 'includes_coo' | 'without_coo' = 'includes_coo';
          if (currentFolder) {
            const placeholderRef = ref(storage, `files/${currentFolder}/.placeholder`);
            try {
              const metadata = await retryOperation(() => getMetadata(placeholderRef));
              folderCategory = (metadata.customMetadata?.category as 'includes_coo' | 'without_coo') || 'includes_coo';
            } catch (error) {
              console.error('Error getting folder category:', error);
            }
          }
          
          // Upload the file with progress tracking
          const uploadTask = uploadBytesResumable(fileRef, file, {
            customMetadata: {
              category: folderCategory
            }
          });
          
          return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
                
                // Calculate upload speed
          const now = Date.now();
          const timeDiff = (now - lastUpdateTime.current) / 1000; // in seconds
                if (timeDiff > 0) {
          const bytesDiff = snapshot.bytesTransferred - lastUploadedBytes.current;
                  const speed = bytesDiff / timeDiff; // bytes per second
          setUploadSpeed(speed);
          
          // Calculate time remaining
          const remainingBytes = snapshot.totalBytes - snapshot.bytesTransferred;
          const remainingTime = remainingBytes / speed;
          setTimeRemaining(remainingTime);
                }
          
          lastUploadedBytes.current = snapshot.bytesTransferred;
          lastUpdateTime.current = now;
                setTotalSize(snapshot.totalBytes);
        },
              async (error) => {
          console.error('Error uploading file:', error);
                if (error.code === 'storage/retry-limit-exceeded') {
                  try {
                    // Try to resume the upload
                    await retryOperation(async () => {
                      uploadTask.resume();
                      return Promise.resolve();
                    });
                  } catch (retryError) {
                    console.error('Failed to resume upload:', retryError);
                    toast.error(`Failed to upload ${file.name} after retries`);
                    reject(retryError);
                  }
                } else {
                  toast.error(`Failed to upload ${file.name}`);
                  reject(error);
                }
        },
        async () => {
                try {
                  const url = await retryOperation(() => getDownloadURL(fileRef));
                  const metadata = await retryOperation(() => getMetadata(fileRef));
                  
                  const newFile: FileItem = {
                    name: file.name,
                    url,
                    path: filePath,
                    type: 'file',
                    parentFolder: currentFolder || 'root',
                    size: file.size,
                    lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
                    category: folderCategory
                  };
                  resolve(newFile);
                } catch (error) {
                  console.error('Error getting file metadata:', error);
                  reject(error);
                }
              }
            );
          });
    } catch (error) {
      console.error('Error uploading file:', error);
          toast.error(`Failed to upload ${file.name}`);
          return null;
        }
      });
      
      const uploadedFiles = await Promise.all(uploadPromises);
      const successfulUploads = uploadedFiles.filter((file): file is FileItem => file !== null);
      
      if (successfulUploads.length > 0) {
        setFiles(prevFiles => [...prevFiles, ...successfulUploads]);
        toast.success(`Successfully uploaded ${successfulUploads.length} file(s)`);
        
        // Dispatch event to notify StorageDashboard
        window.dispatchEvent(new Event('filesUploaded'));
      }
    } catch (error) {
      console.error('Error during upload:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(0);
      setTotalSize(0);
      // Reset the file input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to move this file to the trash bin? You can restore it within 30 days.')) {
      return;
    }
    
    try {
      // Ensure we're within the 'files/' directory
      const safeFilePath = filePath.startsWith('files/') ? filePath : `files/${filePath}`;
      
      // Move to trash bin
      const response = await fetch('/api/trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: safeFilePath,
          fileType: 'file',
          fileName: safeFilePath.split('/').pop()
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to move file to trash bin');
      }
      
      // Delete from storage
      const fileRef = ref(storage, safeFilePath);
      await retryOperation(() => deleteObject(fileRef));
      
      toast.success('File moved to trash bin');
      loadFiles();
      
      // Dispatch event to notify StorageDashboard
      window.dispatchEvent(new Event('fileDeleted'));
    } catch (error) {
      console.error('Error moving file to trash bin:', error);
      toast.error('Failed to move file to trash bin');
    }
  };

  const handleFileClick = async (file: FileItem) => {
    if (file.type === 'folder') {
      handleFolderClick(file);
    } else {
      try {
        // Record file access
        try {
          const response = await fetch('/api/file-access-history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              filePath: file.path,
              displayName: user?.displayName || null
            }),
          });
          
          if (!response.ok) {
            console.error('Failed to record file access history:', await response.text());
          }
        } catch (historyError) {
          console.error('Error recording file access history:', historyError);
          // Continue with file preview even if history recording fails
        }

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

  const handleRename = async () => {
    if (!editingItem || !newName.trim()) return;

    try {
      // Ensure we're working with the correct path format
      const oldPath = editingItem.path.startsWith('files/') ? editingItem.path : `files/${editingItem.path}`;
      
      // Preserve the file extension
      let newFileName = newName.trim();
      if (editingItem.type === 'file') {
        const fileExtension = editingItem.name.split('.').pop();
        if (fileExtension && !newFileName.endsWith(`.${fileExtension}`)) {
          newFileName = `${newFileName}.${fileExtension}`;
        }
      }
      
      const newPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1) + newFileName;
      
      // Encode paths for Firestore document IDs
      const encodedOldPath = encodeURIComponent(oldPath);
      const encodedNewPath = encodeURIComponent(newPath);
      
      if (editingItem.type === 'folder') {
        // For folders, we need to update all files within it
        const folderFiles = files.filter(file => file.path.startsWith(oldPath + '/'));
        
        // Create new folder metadata with the new path
        await retryOperation(() => setDoc(doc(db, 'fileMetadata', encodedNewPath), {
          path: newPath,
          name: newFileName,
          type: 'folder',
          category: editingItem.category || 'includes_coo',
          createdAt: editingItem.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        // Create new placeholder file for the renamed folder
        const newPlaceholderRef = ref(storage, `${newPath}/.placeholder`);
        const emptyBlob = new Blob([''], { type: 'text/plain' });
        await retryOperation(async () => {
          await uploadBytesResumable(newPlaceholderRef, emptyBlob, {
            customMetadata: {
              category: editingItem.category || 'includes_coo'
            }
          });
        });

        // Update all files within the folder
        for (const file of folderFiles) {
          const newFilePath = file.path.replace(oldPath, newPath);
          const encodedFilePath = encodeURIComponent(file.path);
          const encodedNewFilePath = encodeURIComponent(newFilePath);
          
          // Get the file content
          const fileRef = ref(storage, file.path);
          const fileBlob = await retryOperation(() => getBlob(fileRef));
          
          // Get the current metadata
          const metadata = await retryOperation(() => getMetadata(fileRef));
          
          // Create a new file with the new path
          const newFileRef = ref(storage, newFilePath);
          await retryOperation(async () => {
            await uploadBytesResumable(newFileRef, fileBlob, {
              customMetadata: metadata.customMetadata
            });
          });
          
          // Delete the old file
          await retryOperation(() => deleteObject(fileRef));
          // Create new metadata for the file with updated path
          await retryOperation(() => setDoc(doc(db, 'fileMetadata', encodedNewFilePath), {
            path: newFilePath,
            name: file.name,
            type: 'file',
            size: file.size,
            category: file.category || 'includes_coo',
            createdAt: file.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
        }

        // Delete the old folder metadata and placeholder if they exist
        try {
          const oldFolderRef = doc(db, 'fileMetadata', encodedOldPath);
          await retryOperation(() => deleteDoc(oldFolderRef));
          
          const oldPlaceholderRef = ref(storage, `${oldPath}/.placeholder`);
          await retryOperation(() => deleteObject(oldPlaceholderRef));
        } catch (error) {
          console.log('Old folder metadata or placeholder not found, skipping deletion');
        }
      } else {
        // For files, we need to:
        // 1. Get the file content
        // 2. Create a new file with the new name
        // 3. Delete the old file
        // 4. Update metadata
        
        // Get the file content
        const fileRef = ref(storage, oldPath);
        const fileBlob = await retryOperation(() => getBlob(fileRef));
        
        // Get the current metadata
        const metadata = await retryOperation(() => getMetadata(fileRef));
        
        // Create a new file with the new name
        const newFileRef = ref(storage, newPath);
        await retryOperation(async () => {
          await uploadBytesResumable(newFileRef, fileBlob, {
            customMetadata: metadata.customMetadata
          });
        });
        
        // Delete the old file
        await retryOperation(() => deleteObject(fileRef));
        // Create new metadata for the file
        await retryOperation(() => setDoc(doc(db, 'fileMetadata', encodedNewPath), {
          path: newPath,
          name: newFileName,
          type: 'file',
          size: metadata.size,
          contentType: metadata.contentType,
          category: metadata.customMetadata?.category || 'includes_coo',
          createdAt: metadata.timeCreated,
          updatedAt: new Date().toISOString()
        }));

        // Delete the old metadata if it exists
        try {
          const oldMetadataRef = doc(db, 'fileMetadata', encodedOldPath);
          await retryOperation(() => deleteDoc(oldMetadataRef));
        } catch (error) {
          console.log('Old file metadata not found, skipping deletion');
        }
      }

      // Refresh the file list
      await loadFiles();
      setEditingItem(null);
      setNewName('');
      setShowRenameModal(false);
      toast.success('Item renamed successfully');
    } catch (error) {
      console.error('Error renaming item:', error);
      toast.error('Failed to rename item. Please try again.');
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
                  <div className="relative w-full h-full pdf-viewer-container">
                    <style jsx global>{`
                      .pdf-viewer-container iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                      }
                    `}</style>
              <iframe
                      src={`https://docs.google.com/gview?url=${encodeURIComponent(previewFile.url)}&embedded=true`}
                className="w-full h-full"
                title={previewFile.name}
                      onContextMenu={(e) => !isAdmin && e.preventDefault()}
                      sandbox="allow-scripts allow-same-origin"
                    />
                    {!isAdmin && (
                      <div 
                        className="absolute top-0 left-0 w-full h-full" 
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ 
                          pointerEvents: 'none',
                          zIndex: 1
                        }}
                      />
                    )}
                  </div>
            )}
            {isText && (
              <pre className="whitespace-pre-wrap font-mono text-sm text-black">
                {previewFile.url}
              </pre>
            )}
            {!isImage && !isPDF && !isText && (
              <div className="text-center py-8">
                <p className="text-gray-500">Preview not available for this file type</p>
                    {isAdmin && (
                <a
                  href={previewFile.url}
                  download
                  className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Download to View
                </a>
                    )}
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
      try {
        const response = await fetch('/api/file-access-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            filePath: parentPath || 'files',
            displayName: user?.displayName || null
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to record folder access history:', await response.text());
        }
      } catch (historyError) {
        console.error('Error recording folder access history:', historyError);
        // Continue with navigation even if history recording fails
      }
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
    if (!isAdmin || !newFolderName.trim()) return;
    
    try {
      // Sanitize the folder name to prevent path traversal but preserve spaces
      const sanitizedFolderName = newFolderName.replace(/[^a-zA-Z0-9 .-]/g, '_');
      // Always ensure we're within the 'files/' directory
      const folderPath = currentFolder ? `files/${currentFolder}/${sanitizedFolderName}` : `files/${sanitizedFolderName}`;
      
      // Create a placeholder file to represent the folder
      const placeholderPath = `${folderPath}/.placeholder`;
      const placeholderRef = ref(storage, placeholderPath);
      
      // Create an empty file to represent the folder
      const emptyBlob = new Blob([''], { type: 'text/plain' });
      await uploadBytesResumable(placeholderRef, emptyBlob, {
        customMetadata: {
          category: newFolderCategory
        }
      });
      
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowNewFolderInput(false);
      setShowNewSubFolderModal(false);
      setSelectedFolder(null);
      loadFiles();
      
      // Dispatch event to notify StorageDashboard
      window.dispatchEvent(new Event('folderCreated'));
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleCreateSubFolder = (folder: FileItem) => {
    setSelectedFolder(folder);
    setNewFolderName('');
    // Inherit the parent folder's category
    setNewFolderCategory(folder.category || 'includes_coo');
    setShowNewSubFolderModal(true);
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to move this folder and all its contents to the trash bin? You can restore it within 30 days.')) {
      return;
    }

    try {
      // Ensure we're within the 'files/' directory
      const safeFolderPath = folderPath.startsWith('files/') ? folderPath : `files/${folderPath}`;
      
      // List all items in the folder
      const folderRef = ref(storage, safeFolderPath);
      const result = await listAll(folderRef);
      
      // Move all files to trash bin
      const moveToTrashPromises = result.items.map(async (item) => {
        const response = await fetch('/api/trash', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filePath: item.fullPath,
            fileType: 'file',
            fileName: item.fullPath.split('/').pop()
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to move ${item.fullPath} to trash bin`);
        }
        
        return deleteObject(item);
      });
      
      await Promise.all(moveToTrashPromises);
      
      // Move all subfolders to trash bin recursively
      const moveFolderPromises = result.prefixes.map(prefix => handleDeleteFolder(prefix.fullPath));
      await Promise.all(moveFolderPromises);
      
      // Move the folder itself to trash bin
      const response = await fetch('/api/trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: safeFolderPath,
          fileType: 'folder',
          fileName: safeFolderPath.split('/').pop()
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to move folder ${safeFolderPath} to trash bin`);
      }
      
      toast.success('Folder moved to trash bin');
      loadFiles();
      
      // Dispatch event to notify StorageDashboard
      window.dispatchEvent(new Event('folderDeleted'));
    } catch (error) {
      console.error('Error moving folder to trash bin:', error);
      toast.error('Failed to move folder to trash bin');
    }
  };

  const handleFolderClick = async (folder: FileItem) => {
    try {
      // Record folder access
      try {
        const response = await fetch('/api/file-access-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            filePath: folder.path,
            displayName: user?.displayName || null
          }),
        });

        if (!response.ok) {
          console.error('Failed to record folder access history:', await response.text());
        }
      } catch (historyError) {
        console.error('Error recording folder access history:', historyError);
        // Continue with navigation even if history recording fails
      }

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

  const toggleSelectItem = (itemPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems(prev => {
      if (prev.includes(itemPath)) {
        return prev.filter(path => path !== itemPath);
      } else {
        return [...prev, itemPath];
      }
    });
  };

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    if (isMultiSelectMode) {
      setSelectedItems([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    
    if (!isAdmin) return;
    
    if (!confirm(`Are you sure you want to move ${selectedItems.length} item(s) to the trash bin? You can restore them within 30 days.`)) {
      return;
    }

    try {
      const deletePromises = selectedItems.map(async (itemPath) => {
        const item = filteredItems.find(i => i.path === itemPath);
        if (!item) return;
        
        if (item.type === 'folder') {
          await handleDeleteFolder(item.path);
        } else {
          await handleDelete(item.path);
        }
      });
      
      await Promise.all(deletePromises);
      setSelectedItems([]);
      setIsMultiSelectMode(false);
      toast.success(`${selectedItems.length} item(s) moved to trash bin`);
    } catch (error) {
      console.error('Error deleting multiple items:', error);
      toast.error('Failed to delete some items');
    }
  };

  // Fetch user role on component mount
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

  // Get user permissions
  const { isAdmin, canDownload } = getUserPermissions(user?.email, userRole);

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-black">Files</h1>
              {currentFolder && (
                <button
                  onClick={navigateUp}
                  className="text-blue-500 hover:text-blue-600"
                >
                Back
                </button>
              )}
            </div>
          {isAdmin && currentFolder && (
            <div className="flex items-center gap-2">
                  <button
                onClick={() => handleCreateSubFolder({ name: currentFolder, path: `files/${currentFolder}`, url: '', type: 'folder', parentFolder: '' })}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                title="Create sub-folder"
                  >
                <FiFolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">New Sub-Folder</span>
                  </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
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
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-black">Select multiple</span>
                <button
                  onClick={toggleMultiSelectMode}
                  className={`p-2 ${isMultiSelectMode ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100'} rounded-lg`}
                  title={isMultiSelectMode ? "Exit multi-select mode" : "Select multiple files"}
                >
                  {isMultiSelectMode ? <FiCheckSquare className="w-5 h-5" /> : <FiSquare className="w-5 h-5" />}
                </button>
              </div>
              {isMultiSelectMode && selectedItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black">Delete selected</span>
                  <button
                    onClick={handleBulkDelete}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    title={`Delete ${selectedItems.length} selected item(s)`}
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowNewFolderInput(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                title="Create new folder"
              >
                <FiFolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">New Folder</span>
              </button>
              <label className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer text-sm" title="Upload file">
                <FiUpload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
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
        <div className="relative mb-4">
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
          <div className={`mt-4 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}`}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.path}
                className={`${
                  viewMode === 'grid'
                    ? 'p-4 border rounded-lg hover:bg-gray-50 cursor-pointer relative'
                    : 'p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between'
                } ${selectedItems.includes(item.path) ? 'bg-blue-50 border-blue-200' : ''}`}
                onClick={(e) => isMultiSelectMode ? toggleSelectItem(item.path, e) : handleFileClick(item)}
              >
                <div className={`flex ${viewMode === 'list' ? 'items-center gap-3' : 'flex-col items-center'}`}>
                  {isMultiSelectMode && (
                    <div 
                      className={`mr-2 ${viewMode === 'grid' ? 'absolute top-2 left-2' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                        toggleSelectItem(item.path, e);
                      }}
                    >
                      {selectedItems.includes(item.path) ? (
                        <FiCheckSquare className="w-5 h-5 text-blue-500" />
                      ) : (
                        <FiSquare className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  )}
                  {item.type === 'folder' ? (
                    <FiFolder className={`${viewMode === 'grid' ? 'w-12 h-12 mb-2' : 'w-6 h-6'} text-blue-500`} />
                  ) : (
                    <div className={`${viewMode === 'grid' ? 'w-12 h-12 mb-2' : 'w-6 h-6'} flex items-center justify-center`}>
                      {getFileIcon(item.name)}
                    </div>
                  )}
                  <div className={viewMode === 'grid' ? 'text-center' : ''}>
                    <div className={`font-medium text-black ${item.type === 'folder' ? '' : 'truncate max-w-[150px]'}`}>
                      {item.name}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1 text-xs text-gray-500">
                      {item.size !== undefined && (
                        <span className="whitespace-nowrap">{formatBytes(item.size)}</span>
                      )}
                      {item.type === 'folder' && item.createdAt ? (
                        <span className="whitespace-nowrap" title="Created">
                          Created: {new Date(item.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      ) : item.lastModified ? (
                        <span className="whitespace-nowrap" title="Modified">
                          {new Date(item.lastModified).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      ) : null}
                    </div>
                    {searchQuery && (
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">
                        {item.path}
                      </div>
                    )}
                  </div>
                </div>
                        {/* File actions */}
                        {!isMultiSelectMode && (
                          <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'absolute top-2 right-2' : ''}`}>
                            {/* Show download button for admin and editor roles */}
                            {(isAdmin || canDownload) && item.type === 'file' && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-green-500 hover:text-green-700"
                                title="Download file"
                              >
                                <FiDownload className="w-5 h-5" />
                              </a>
                            )}
                            {/* Show rename and delete buttons only for admin */}
                      {isAdmin && (
                              <>
                                {/* Show rename button only for files in root */}
                                {item.type === 'file' && !item.parentFolder && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                                      setEditingItem(item);
                                      setNewName(item.name);
                                      setShowRenameModal(true);
                          }}
                                    className="text-blue-500 hover:text-blue-700"
                                    title="Rename"
                        >
                                    <FiEdit2 className="w-5 h-5" />
                        </button>
                      )}
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
                            title="Delete"
                          >
                                  <FiTrash2 className="w-5 h-5" />
                          </button>
                              </>
                        )}
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
      {renderPreview()}

      {/* New Folder Modal */}
      {showNewFolderInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-black">Create New Folder</h2>
                          <button
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="w-5 h-5" />
                          </button>
      </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                autoFocus
              />
                </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={newFolderCategory}
                onChange={(e) => setNewFolderCategory(e.target.value as 'includes_coo' | 'without_coo')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="includes_coo">Includes C of O</option>
                <option value="without_coo">Without C of O</option>
              </select>
              </div>
            <div className="flex justify-end gap-3">
                          <button
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
                          </button>
              <button
                onClick={createFolder}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Create
              </button>
                      </div>
                </div>
              </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-black">Rename {editingItem.type === 'folder' ? 'Folder' : 'File'}</h2>
              <button 
                onClick={() => {
                  setShowRenameModal(false);
                  setEditingItem(null);
                  setNewName('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="w-5 h-5" />
              </button>
          </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Enter new ${editingItem.type} name`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
              />
              {editingItem.type === 'file' && (
                <p className="mt-2 text-xs text-gray-500">
                  Note: The file extension will be preserved automatically.
              </p>
            )}
          </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setEditingItem(null);
                  setNewName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRename()}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                Rename
              </button>
        </div>
      </div>
        </div>
      )}

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg w-80">
          <div className="flex justify-between items-center mb-2">
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
            <span>{uploadSpeed > 0 ? `${formatBytes(uploadSpeed)}/s` : 'Calculating...'}</span>
            <span>{timeRemaining > 0 ? `${formatTime(timeRemaining)} remaining` : 'Almost done'}</span>
          </div>
        </div>
      )}

      {/* New Sub-Folder Modal */}
      {showNewSubFolderModal && selectedFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-black">Create Sub-Folder in {selectedFolder.name}</h2>
              <button
                onClick={() => {
                  setShowNewSubFolderModal(false);
                  setSelectedFolder(null);
                  setNewFolderName('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNewSubFolderModal(false);
                  setSelectedFolder(null);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {isMultiSelectMode && (
        <div className="mt-2 mb-2 text-sm text-black">
          {selectedItems.length} item(s) selected
        </div>
      )}
    </div>
  );
}