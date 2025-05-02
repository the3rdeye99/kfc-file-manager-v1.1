'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, uploadBytesResumable, listAll, getDownloadURL, deleteObject, UploadTaskSnapshot, UploadTask, getMetadata, getBlob, updateMetadata } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiTrash2, FiFolderPlus, FiGrid, FiList, FiSearch, FiEye, FiX, FiUpload, FiRefreshCw, FiFile, FiImage, FiFileText, FiArchive, FiVideo, FiMusic, FiCode, FiEdit2, FiSave, FiDownload, FiCheckSquare, FiSquare, FiLock, FiUnlock } from 'react-icons/fi';
import { FaFolder } from 'react-icons/fa';
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
  category?: 'none' | 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'scanned_documents' | 'invoices_billing' | 'certificate_of_occupancy' | 'evidence_files' | 'property_ownership' | 'title_deeds' | 'lease_agreements' | 'land_use_files' | 'client_correspondence' | 'includes_coo' | 'without_coo' | 'evidence_documents';
  createdAt?: number;
  isLocked?: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

// Helper function to check user permissions
const getUserPermissions = (email: string | null | undefined, role?: string) => {
  if (!email) return { isAdmin: false, canDownload: false, canLock: false };
  
  // Admin has all permissions
  if (email === 'admin@kayodefilani.com') {
    return { isAdmin: true, canDownload: true, canLock: true };
  }
  
  // Check role-based permissions
  if (role === 'editor') {
    return { isAdmin: false, canDownload: true, canLock: true };
  }
  
  // Default to viewer permissions
  return { isAdmin: false, canDownload: false, canLock: false };
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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
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
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing' | 'includes_coo' | 'without_coo'>('all');
  const [newFolderCategory, setNewFolderCategory] = useState<'includes_coo' | 'without_coo'>('includes_coo');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showNewSubFolderModal, setShowNewSubFolderModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FileItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<'none' | 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'scanned_documents' | 'invoices_billing' | 'certificate_of_occupancy' | 'evidence_files' | 'property_ownership' | 'title_deeds' | 'lease_agreements' | 'land_use_files'>('none');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const fileListRef = useRef<HTMLDivElement>(null);

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
          let folderCategory: 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing' = 'contracts';
          if (currentFolder) {
            const placeholderRef = ref(storage, `files/${currentFolder}/.placeholder`);
            try {
              const folderMetadata = await getMetadata(placeholderRef);
              folderCategory = (folderMetadata.customMetadata?.category as 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing') || 'contracts';
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
            category: metadata.customMetadata?.category as 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing' || folderCategory
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
          const placeholderRef = ref(storage, `${prefix.fullPath}/.placeholder`);
          try {
            const metadata = await getMetadata(placeholderRef);
            const folderItem: FileItem = {
              name: prefix.name,
              path: prefix.fullPath,
              url: '',
              type: 'folder',
              parentFolder: currentFolder,
              category: metadata.customMetadata?.category as 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing',
              createdAt: metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : undefined,
              lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
              isLocked: metadata.customMetadata?.isLocked === 'true',
              lockedBy: metadata.customMetadata?.lockedBy,
              lockedAt: metadata.customMetadata?.lockedAt
            };
            return folderItem;
          } catch (error) {
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
            category: metadata.customMetadata?.category as 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing'
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
              metadata = { customMetadata: { category: 'contracts' } };
            }
            
            const folderItem = {
        name: prefix.name,
        url: '',
        path: prefix.fullPath,
        type: 'folder' as const,
              parentFolder: folderPath.replace('files/', ''),
              category: metadata.customMetadata?.category as 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing',
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
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const searchQuery = query.toLowerCase();
      const allFiles: FileItem[] = [];

      // Function to recursively search through folders
      const searchFolder = async (folderPath: string) => {
        const folderRef = ref(storage, folderPath);
        const result = await listAll(folderRef);

        // Process files in current folder
        const filePromises = result.items.map(async (item) => {
          try {
            const url = await getDownloadURL(item);
            const metadata = await getMetadata(item);
            const fileName = item.name.toLowerCase();
            const fileCategory = metadata.customMetadata?.category?.toLowerCase() || '';
            
            // Check if file matches search query in name or category
            if (fileName.includes(searchQuery) || fileCategory.includes(searchQuery)) {
              const fileItem: FileItem = {
                name: item.name,
                url,
                path: item.fullPath,
                type: 'file',
                parentFolder: folderPath.replace('files/', ''),
                size: metadata.size,
                lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
                category: metadata.customMetadata?.category as FileItem['category']
              };
              return fileItem;
            }
            return null;
          } catch (error) {
            console.error('Error processing file:', error);
            return null;
          }
        });

        // Process subfolders
        const subfolderPromises = result.prefixes.map(async (prefix) => {
          try {
            const folderName = prefix.name.toLowerCase();
            // Get folder metadata from the .placeholder file
            const placeholderRef = ref(storage, `${prefix.fullPath}/.placeholder`);
            let folderCategory = 'contracts'; // Default category
            let isLocked = false;
            let lockedBy = '';
            let lockedAt = '';
            
            try {
              const placeholderMetadata = await getMetadata(placeholderRef);
              folderCategory = placeholderMetadata.customMetadata?.category || 'contracts';
              isLocked = placeholderMetadata.customMetadata?.isLocked === 'true';
              lockedBy = placeholderMetadata.customMetadata?.lockedBy || '';
              lockedAt = placeholderMetadata.customMetadata?.lockedAt || '';
            } catch (error) {
              console.log('No placeholder file found, using default category');
            }

            // Check if folder matches search query in name or category
            if (folderName.includes(searchQuery) || folderCategory.toLowerCase().includes(searchQuery)) {
              const folderItem: FileItem = {
                name: prefix.name,
                url: '',
                path: prefix.fullPath,
                type: 'folder',
                parentFolder: folderPath.replace('files/', ''),
                category: folderCategory as FileItem['category'],
                isLocked,
                lockedBy,
                lockedAt
              };
              allFiles.push(folderItem);
            }
            await searchFolder(prefix.fullPath);
          } catch (error) {
            console.error('Error processing folder:', error);
          }
        });

        const files = await Promise.all(filePromises);
        const validFiles = files.filter((file): file is FileItem => file !== null);
        allFiles.push(...validFiles);
        await Promise.all(subfolderPromises);
      };

      // Start search from the root 'files' directory
      await searchFolder('files');
      setSearchResults(allFiles);
    } catch (error) {
      console.error('Error during search:', error);
      toast.error('Failed to perform search');
    } finally {
      setIsSearching(false);
    }
  };

  // Update the search input onChange handler
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      handleSearch(query);
    }, 300),
    []
  );

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, debouncedSearch]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
    setUploading(true);
    setUploadProgress(0);
    setUploadSpeed(0);
    setTimeRemaining(0);
      setTotalSize(0);
    lastUploadedBytes.current = 0;
    lastUpdateTime.current = Date.now();
    
      const uploadTasksArray: UploadTask[] = [];
      setUploadTasks(uploadTasksArray);
      
      const uploadPromises = Array.from(e.target.files).map(async (file) => {
        try {
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9 .-]/g, '_');
          const filePath = currentFolder ? `files/${currentFolder}/${sanitizedFileName}` : `files/${sanitizedFileName}`;
    const fileRef = ref(storage, filePath);

          const uploadTask = uploadBytesResumable(fileRef, file, {
            customMetadata: {
              category: selectedCategory
            }
          });
          
          uploadTasksArray.push(uploadTask);
          
          return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
                
          const now = Date.now();
                const timeDiff = (now - lastUpdateTime.current) / 1000;
                if (timeDiff > 0) {
          const bytesDiff = snapshot.bytesTransferred - lastUploadedBytes.current;
                  const speed = bytesDiff / timeDiff;
          setUploadSpeed(speed);
          
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
                    category: selectedCategory === 'all' ? undefined : selectedCategory
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
      setUploadTasks([]);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone and the file cannot be restored.')) {
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
      try {
        await retryOperation(() => deleteObject(fileRef));
      } catch (deleteError: any) {
        // If the file doesn't exist, it's already deleted
        if (deleteError.code !== 'storage/object-not-found') {
          throw deleteError;
        }
      }
      
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
      // Don't open preview if clicking on category dropdown
      if (showCategoryDropdown === file.path) {
        return;
      }
      try {
        setIsPreviewLoading(true);
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
        
        // Add a small delay to ensure loading indicator is visible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setIsPreviewLoading(false);
      } catch (error) {
        console.error('Error accessing file:', error);
        toast.error('Failed to access file');
        setIsPreviewLoading(false);
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
          category: editingItem.category || 'contracts',
          createdAt: editingItem.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        // Create new placeholder file for the renamed folder
        const newPlaceholderRef = ref(storage, `${newPath}/.placeholder`);
        const emptyBlob = new Blob([''], { type: 'text/plain' });
        await retryOperation(async () => {
          await uploadBytesResumable(newPlaceholderRef, emptyBlob, {
            customMetadata: {
              category: editingItem.category || 'contracts'
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
            category: file.category || 'contracts',
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
          category: metadata.customMetadata?.category || 'contracts',
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
            {isPreviewLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600">Loading preview...</p>
                </div>
              </div>
            ) : (
              <>
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
      
      // Reset category to "All Files" before navigating up
      setSelectedCategory('all');
      
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
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    // Sanitize folder name
    const sanitizedFolderName = newFolderName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '');

    if (!sanitizedFolderName) {
      toast.error('Invalid folder name');
      return;
    }

    try {
      // Always ensure we're within the 'files/' directory
      const folderPath = currentFolder ? `files/${currentFolder}/${sanitizedFolderName}` : `files/${sanitizedFolderName}`;
      
      // Create a placeholder file to represent the folder
      const placeholderPath = `${folderPath}/.placeholder`;
      const placeholderRef = ref(storage, placeholderPath);
      
      // Create an empty file to represent the folder
      const emptyBlob = new Blob([''], { type: 'text/plain' });
      await uploadBytesResumable(placeholderRef, emptyBlob, {
        customMetadata: {
          category: newFolderCategory,
          isLocked: 'false',
          lockedBy: '',
          lockedAt: ''
        }
      });
      
      toast.success('Folder created successfully');
      setNewFolderName('');
      setShowNewFolderInput(false);
      setShowNewSubFolderModal(false);
      setSelectedFolder(null);
      
      // If user is admin, automatically open the new folder
      if (isAdmin) {
        const newFolderItem: FileItem = {
          name: sanitizedFolderName,
          path: folderPath,
          url: '',
          type: 'folder',
          parentFolder: currentFolder || 'root',
          category: newFolderCategory,
          createdAt: Date.now(),
          isLocked: false,
          lockedBy: '',
          lockedAt: ''
        };
        await handleFolderClick(newFolderItem);
      } else {
        loadFiles();
      }
      
      // Dispatch event to notify StorageDashboard
      window.dispatchEvent(new Event('folderCreated'));
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleCreateSubFolder = (folder: FileItem) => {
    // Check if folder is locked
    if (folder.isLocked) {
      toast.error('Cannot create subfolder in a locked folder');
      return;
    }
    
    setSelectedFolder(folder);
    setNewFolderName('');
    // Inherit the parent folder's category, defaulting to 'includes_coo' if not set
    setNewFolderCategory(folder.category === 'includes_coo' || folder.category === 'without_coo' ? folder.category : 'includes_coo');
    setShowNewSubFolderModal(true);
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to delete this folder and all its contents? This action cannot be undone and the files cannot be restored.')) {
      return;
    }

    try {
      // Ensure we're within the 'files/' directory
      const safeFolderPath = folderPath.startsWith('files/') ? folderPath : `files/${folderPath}`;
      
      // Check if folder is locked
      try {
        const placeholderRef = ref(storage, `${safeFolderPath}/.placeholder`);
        const metadata = await getMetadata(placeholderRef);
        if (metadata.customMetadata?.isLocked === 'true') {
          toast.error('Cannot delete a locked folder');
          return;
        }
      } catch (error: any) {
        // If the placeholder doesn't exist, continue with deletion
        if (error.code !== 'storage/object-not-found') {
          throw error;
        }
      }
      
      // Delete all files in the folder
      const folderRef = ref(storage, safeFolderPath);
      const result = await listAll(folderRef);
      
      // Delete all files
      const deletePromises = result.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);
      
      // Delete all subfolders recursively
      const subfolderPromises = result.prefixes.map(prefix => handleDeleteFolder(prefix.fullPath));
      await Promise.all(subfolderPromises);
      
      // Try to delete the placeholder file if it exists
      try {
        const placeholderRef = ref(storage, `${safeFolderPath}/.placeholder`);
        await deleteObject(placeholderRef);
      } catch (error: any) {
        // If the placeholder doesn't exist, that's fine
        if (error.code !== 'storage/object-not-found') {
          throw error;
        }
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
      // Check if folder is locked and user is not admin or editor
      if (folder.isLocked && !isAdmin && !canLock) {
        toast.error('This folder is locked and cannot be accessed');
        return;
      }

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

      // Reset category filter when entering a folder
      setSelectedCategory('all');

      // Ensure we're within the 'files/' directory
      const safePath = folder.path.startsWith('files/') ? folder.path.replace('files/', '') : folder.path;
      setCurrentFolder(safePath);
      
      // Reset pagination state
      setCurrentPage(1);
      
      // Load folder contents immediately
      const folderRef = ref(storage, folder.path);
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
          parentFolder: folder.path.replace('files/', ''),
          size: metadata.size,
          lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
          category: metadata.customMetadata?.category as 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing'
        };
      });

      // Process subfolders
      interface CustomMetadata {
  category?: 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing';
  isLocked?: string;
  lockedBy?: string;
  lockedAt?: string;
  [key: string]: string | undefined;
}

interface SafeMetadata {
  customMetadata: CustomMetadata;
  timeCreated?: string;
  updated?: string;
}

const folderPromises = result.prefixes.map(async (prefix) => {
  try {
    const placeholderRef = ref(storage, `${prefix.fullPath}/.placeholder`);
    let metadata: SafeMetadata;

    try {
      metadata = await getMetadata(placeholderRef) as SafeMetadata;
    } catch (error) {
      metadata = {
        customMetadata: {
          category: 'contracts'
        }
      };
    }

    const custom = metadata.customMetadata;

    return {
      name: prefix.name,
      url: '',
      path: prefix.fullPath,
      type: 'folder' as const,
      parentFolder: folder.path.replace('files/', ''),
      category: custom.category,
      createdAt: metadata.timeCreated ? new Date(metadata.timeCreated).getTime() : undefined,
      lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
      isLocked: custom.isLocked === 'true',
      lockedBy: custom.lockedBy,
      lockedAt: custom.lockedAt
    };
  } catch (error) {
    console.error(`Error processing folder ${prefix.fullPath}:`, error);
    return null;
  }
});


      const [files, folders] = await Promise.all([
        Promise.all(filePromises),
        Promise.all(folderPromises)
      ]);

      const validFolders = folders.filter(folder => folder !== null) as FileItem[];
      const allItems = [...files, ...validFolders];
      
      // Update both files and allFiles states
      setFiles(allItems);
      setAllFiles(allItems);
      
      // Clear search query after successful navigation
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
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
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} item(s)? This action cannot be undone and the files cannot be restored.`)) {
      return;
    }

    try {
      const deletePromises = selectedItems.map(async (itemPath) => {
        const item = filteredItems.find(i => i.path === itemPath);
        if (!item) return;
        
        // Ensure we're within the 'files/' directory
        const safePath = item.path.startsWith('files/') ? item.path : `files/${item.path}`;
        
        if (item.type === 'folder') {
          // For folders, we need to handle them differently to avoid multiple confirmations
          try {
            // Check if folder is locked
            try {
              const placeholderRef = ref(storage, `${safePath}/.placeholder`);
              const metadata = await getMetadata(placeholderRef);
              if (metadata.customMetadata?.isLocked === 'true') {
                toast.error(`Cannot delete locked folder: ${item.name}`);
                return;
              }
            } catch (error: any) {
              // If the placeholder doesn't exist, continue with deletion
              if (error.code !== 'storage/object-not-found') {
                throw error;
              }
            }
            
            // List all items in the folder
            const folderRef = ref(storage, safePath);
            const result = await listAll(folderRef);
            
            // Delete all files
            const deletePromises = result.items.map(item => deleteObject(item));
            await Promise.all(deletePromises);
            
            // Delete all subfolders recursively
            const subfolderPromises = result.prefixes.map(prefix => handleDeleteFolder(prefix.fullPath));
            await Promise.all(subfolderPromises);
            
            // Try to delete the placeholder file if it exists
            try {
              const placeholderRef = ref(storage, `${safePath}/.placeholder`);
              await deleteObject(placeholderRef);
            } catch (error: any) {
              // If the placeholder doesn't exist, that's fine
              if (error.code !== 'storage/object-not-found') {
                throw error;
              }
            }
          } catch (error) {
            console.error(`Error deleting folder ${safePath}:`, error);
            throw error;
          }
        } else {
          // For files, delete directly without confirmation
          try {
            const fileRef = ref(storage, safePath);
            await retryOperation(() => deleteObject(fileRef));
          } catch (error: any) {
            // If the file doesn't exist, it's already deleted
            if (error.code !== 'storage/object-not-found') {
              throw error;
            }
          }
        }
      });
      
      await Promise.all(deletePromises);
      setSelectedItems([]);
      setIsMultiSelectMode(false);
      toast.success(`${selectedItems.length} item(s) deleted successfully`);
      
      // Refresh the file list
      loadFiles();
      
      // Dispatch event to notify StorageDashboard
      window.dispatchEvent(new Event('filesDeleted'));
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
  const { isAdmin, canDownload, canLock } = getUserPermissions(user?.email, userRole);

  const handleCancelUpload = () => {
    if (uploadTasks.length > 0) {
      // Cancel all upload tasks
      uploadTasks.forEach(task => {
        task.cancel();
      });
      
      // Clear the upload tasks array
      setUploadTasks([]);
      
      // Reset upload state
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(0);
      setTotalSize(0);
      
      toast('Upload cancelled', {
        style: {
          background: '#4B5563',
          color: '#fff'
        }
      });
    }
  };

  const handleLockFolder = async (folder: FileItem) => {
    if (!isAdmin && !canLock) return;

    try {
      const folderRef = ref(storage, `${folder.path}/.placeholder`);
      const metadata = await getMetadata(folderRef);
      
      const newMetadata = {
        ...metadata.customMetadata,
        isLocked: metadata.customMetadata?.isLocked === 'true' ? 'false' : 'true',
        lockedBy: metadata.customMetadata?.isLocked === 'true' ? '' : user?.email || '',
        lockedAt: metadata.customMetadata?.isLocked === 'true' ? '' : new Date().toISOString()
      };

      await updateMetadata(folderRef, {
        customMetadata: newMetadata
      });

      // Update the local state immediately
      setFiles(prevFiles => 
        prevFiles.map(file => 
          file.path === folder.path 
            ? { 
                ...file, 
                isLocked: newMetadata.isLocked === 'true',
                lockedBy: newMetadata.lockedBy,
                lockedAt: newMetadata.lockedAt
              }
            : file
        )
      );

      toast.success(metadata.customMetadata?.isLocked === 'true' ? 'Folder unlocked successfully' : 'Folder locked successfully');
    } catch (error) {
      console.error('Error locking/unlocking folder:', error);
      toast.error('Failed to lock/unlock folder');
    }
  };

  // Add a useEffect to listen for metadata changes
  useEffect(() => {
    const listenForMetadataChanges = async () => {
      try {
        const currentPath = currentFolder === 'root' ? 'files' : `files/${currentFolder}`;
        const folderRef = ref(storage, currentPath);
        
        // List all files and folders
        const result = await listAll(folderRef);
        
        // Process folders (items ending with .placeholder)
        const folderPromises = result.prefixes.map(async (prefix) => {
          try {
            const placeholderRef = ref(storage, `${prefix.fullPath}/.placeholder`);
            const metadata = await getMetadata(placeholderRef);
            
            // Update the local state if metadata has changed
            setFiles(prevFiles => 
              prevFiles.map(file => 
                file.path === prefix.fullPath 
                  ? { 
                      ...file, 
                      isLocked: metadata.customMetadata?.isLocked === 'true',
                      lockedBy: metadata.customMetadata?.lockedBy || '',
                      lockedAt: metadata.customMetadata?.lockedAt || ''
                    }
                  : file
              )
            );
          } catch (error) {
            console.error('Error processing folder metadata:', error);
          }
        });
        
        await Promise.all(folderPromises);
      } catch (error) {
        console.error('Error listening for metadata changes:', error);
      }
    };

    // Set up an interval to check for metadata changes
    const intervalId = setInterval(listenForMetadataChanges, 5000); // Check every 5 seconds

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [currentFolder]);

  // Update the folder icon section
  const renderFolderIcon = (item: FileItem) => {
    return (
      <div className="flex items-center">
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLockFolder(item);
            }}
            className="mr-2"
          >
            {item.isLocked ? (
              <FiLock className="w-5 h-5 text-red-500" />
            ) : (
              <FiUnlock className="w-5 h-5 text-blue-500" />
            )}
          </button>
        )}
        <FaFolder className={`${viewMode === 'grid' ? 'w-12 h-12 mb-2' : 'w-6 h-6'} ${isAdmin ? 'text-blue-500' : (item.isLocked ? 'text-red-500' : 'text-blue-500')}`} />
      </div>
    );
  };

  const UploadModal = () => {
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setSelectedFiles(Array.from(e.target.files));
      }
    };

    const handleUpload = async () => {
      if (selectedFiles.length === 0) {
        toast.error('Please select at least one file to upload');
        return;
      }

      try {
        setUploading(true);
        setUploadProgress(0);
        setUploadSpeed(0);
        setTimeRemaining(0);
        setTotalSize(0);
        lastUploadedBytes.current = 0;
        lastUpdateTime.current = Date.now();
        
        const uploadTasksArray: UploadTask[] = [];
        setUploadTasks(uploadTasksArray);
        
        // Close the modal immediately when upload starts
        setShowUploadModal(false);
        
        const uploadPromises = selectedFiles.map(async (file) => {
          try {
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9 .-]/g, '_');
            const filePath = currentFolder ? `files/${currentFolder}/${sanitizedFileName}` : `files/${sanitizedFileName}`;
            const fileRef = ref(storage, filePath);

            const uploadTask = uploadBytesResumable(fileRef, file, {
              customMetadata: {
                category: uploadCategory
              }
            });
            
            uploadTasksArray.push(uploadTask);
            
            return new Promise((resolve, reject) => {
              uploadTask.on('state_changed',
                (snapshot) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  setUploadProgress(progress);
                  
                  const now = Date.now();
                  const timeDiff = (now - lastUpdateTime.current) / 1000;
                  if (timeDiff > 0) {
                    const bytesDiff = snapshot.bytesTransferred - lastUploadedBytes.current;
                    const speed = bytesDiff / timeDiff;
                    setUploadSpeed(speed);
                    
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
                      category: uploadCategory as 'includes_coo' | 'without_coo' | 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing' | undefined
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
        setUploadTasks([]);
        setSelectedFiles([]);
        setShowUploadModal(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-black">Upload Files</h2>
            <button
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFiles([]);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Files</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  Click to select files or drag and drop
                </span>
              </label>
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Files:</h3>
                <div className="max-h-40 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">{formatBytes(file.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as typeof uploadCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="none">None</option>
              <option value="contracts">Contracts</option>
              <option value="certificate_of_occupancy">Certificate of Occupancy</option>
              <option value="case_files">Case Files</option>
              <option value="court_filings">Court Filings</option>
              <option value="legal_memos">Legal Memos</option>
              <option value="briefs">Briefs</option>
              <option value="client_correspondence">Client Correspondence</option>
              <option value="evidence_files">Evidence Files</option>
              <option value="scanned_documents">Scanned Documents</option>
              <option value="invoices_billing">Invoices & Billing</option>
              <option value="property_ownership">Property Ownership</option>
              <option value="title_deeds">Title Deeds</option>
              <option value="lease_agreements">Lease Agreements</option>
              <option value="land_use_files">Land Use Files</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFiles([]);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryDropdown = (item: FileItem) => {
    if (showCategoryDropdown !== item.path || !isAdmin) return null;

    const categories = [
      'none',
      'contracts',
      'case_files',
      'court_filings',
      'legal_memos',
      'briefs',
      'scanned_documents',
      'invoices_billing',
      'certificate_of_occupancy',
      'evidence_files',
      'property_ownership',
      'title_deeds',
      'lease_agreements',
      'land_use_files'
    ];

    return (
      <div 
        className="fixed z-50 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200"
        style={{ 
          maxHeight: '200px', 
          overflowY: 'auto',
          position: 'fixed',
          top: 'auto',
          bottom: '0',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '1rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-1">
          {categories.map((category) => (
            <button
              key={category}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                item.category === category ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleCategoryChange(item.path, category);
                setShowCategoryDropdown(null);
              }}
            >
              {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const handleCategoryChange = async (filePath: string, newCategory: string) => {
    if (!isAdmin) {
      toast.error('Only administrators can change file categories');
      return;
    }

    // Check if the file is a .placeholder file
    if (filePath.endsWith('/.placeholder')) {
      toast.error('Cannot change category of folder placeholder files');
      return;
    }

    try {
      const fileRef = ref(storage, filePath);
      const metadata = {
        customMetadata: {
          category: newCategory
        }
      };
      await updateMetadata(fileRef, metadata);
      toast.success('Category updated successfully');
      loadFiles();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  // Add pagination functions
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // First scroll to top of page
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    // Then scroll to the file list container after a short delay
    setTimeout(() => {
      if (fileListRef.current) {
        const headerHeight = 200; // Approximate height of header elements
        const scrollPosition = fileListRef.current.offsetTop - headerHeight;
        window.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 100); // Small delay to ensure the page has scrolled to top first
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Update the filtered items to include pagination
  const paginatedItems = (searchQuery ? searchResults : files)
    .filter(item => {
      if (selectedCategory === 'all') return true;
      return item.category === selectedCategory;
    })
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate total pages
  useEffect(() => {
    const filteredItems = (searchQuery ? searchResults : files)
      .filter(item => {
        if (selectedCategory === 'all') return true;
        return item.category === selectedCategory;
      });
    setTotalPages(Math.ceil(filteredItems.length / itemsPerPage));
  }, [files, searchResults, searchQuery, selectedCategory, itemsPerPage]);

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-black">Files</h1>
            {currentFolder && !isRefreshing && (
              <button
                onClick={navigateUp}
                className="text-blue-500 hover:text-blue-600"
              >
                Back
              </button>
            )}
          </div>
        </div>
        {/* Make both breadcrumb and search sticky */}
        <div className="sticky top-0 z-10 bg-white">
          {/* Breadcrumb path */}
          <div className="py-2 border-b">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <button
                onClick={() => navigateToFolder('')}
                className="hover:text-blue-500"
              >
                Root
              </button>
              {currentFolder.split('/').map((folder, index, array) => {
                const path = array.slice(0, index + 1).join('/');
                return (
                  <div key={path} className="flex items-center gap-2">
                    <span>/</span>
                    <button
                      onClick={() => navigateToFolder(path)}
                      className="hover:text-blue-500"
                    >
                      {folder}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Search component */}
          <div className="py-4 border-b">
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
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as 'all' | 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing' | 'includes_coo' | 'without_coo')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="all">All Files</option>
              {!currentFolder ? (
                <>
                  <option value="includes_coo">Includes C of O</option>
                  <option value="without_coo">Without C of O</option>
                </>
              ) : (
                <>
                  <option value="contracts">Contracts</option>
                  <option value="certificate_of_occupancy">Certificate of Occupancy</option>
                  <option value="case_files">Case Files</option>
                  <option value="court_filings">Court Filings</option>
                  <option value="legal_memos">Legal Memos</option>
                  <option value="briefs">Briefs</option>
                  <option value="client_correspondence">Client Correspondence</option>
                  <option value="evidence_files">Evidence Files</option>
                  <option value="scanned_documents">Scanned Documents</option>
                  <option value="invoices_billing">Invoices & Billing</option>
                  <option value="property_ownership">Property Ownership</option>
                  <option value="title_deeds">Title Deeds</option>
                  <option value="lease_agreements">Lease Agreements</option>
                  <option value="land_use_files">Land Use Files</option>
                </>
              )}
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
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
            >
              <FiGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
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
              {currentFolder ? (
                <>
                  <button
                    onClick={() => handleCreateSubFolder({ name: currentFolder, path: `files/${currentFolder}`, url: '', type: 'folder', parentFolder: '' })}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    title="Create sub-folder"
                  >
                    <FiFolderPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">New Sub-Folder</span>
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    title="Upload file"
                    disabled={uploading}
                  >
                    <FiUpload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  title="Create new folder"
                >
                  <FiFolderPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Folder</span>
                </button>
              )}
            </div>
          )}
        </div>
        <div ref={fileListRef} className={`mt-4 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}`}>
          {paginatedItems.length > 0 ? (
            paginatedItems.map((item) => (
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
                    renderFolderIcon(item)
                  ) : (
                    <div className={`${viewMode === 'grid' ? 'w-12 h-12 mb-2' : 'w-6 h-6'} flex items-center justify-center`}>
                      {getFileIcon(item.name)}
                    </div>
                  )}
                  <div className={viewMode === 'grid' ? 'text-center' : ''}>
                    <div className={`font-medium text-black ${item.type === 'folder' ? '' : 'truncate max-w-[300px]'}`}>
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
                      {item.type === 'file' && (
                        <div className="relative">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.category === 'none' ? 'bg-gray-100 text-gray-800' :
                              item.category === 'contracts' ? 'bg-blue-100 text-blue-800' :
                              item.category === 'case_files' ? 'bg-green-100 text-green-800' :
                              item.category === 'court_filings' ? 'bg-purple-100 text-purple-800' :
                              item.category === 'legal_memos' ? 'bg-yellow-100 text-yellow-800' :
                              item.category === 'briefs' ? 'bg-indigo-100 text-indigo-800' :
                              item.category === 'scanned_documents' ? 'bg-pink-100 text-pink-800' :
                              item.category === 'invoices_billing' ? 'bg-red-100 text-red-800' :
                              item.category === 'certificate_of_occupancy' ? 'bg-orange-100 text-orange-800' :
                              item.category === 'evidence_files' ? 'bg-teal-100 text-teal-800' :
                              item.category === 'property_ownership' ? 'bg-cyan-100 text-cyan-800' :
                              item.category === 'title_deeds' ? 'bg-lime-100 text-lime-800' :
                              item.category === 'lease_agreements' ? 'bg-amber-100 text-amber-800' :
                              'bg-gray-100 text-gray-800'
                            } ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                            onClick={(e) => {
                              if (!isAdmin) return;
                              e.stopPropagation();
                              setShowCategoryDropdown(showCategoryDropdown === item.path ? null : item.path);
                            }}
                          >
                            {item.category ? item.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'None'}
                          </span>
                          {renderCategoryDropdown(item)}
                        </div>
                      )}
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

        {/* Add pagination controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {paginatedItems.filter(item => item.type === 'folder').length} folders
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-lg ${
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-lg ${
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
              }`}
            >
              Next
            </button>
          </div>
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
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
              <button 
                onClick={handleCancelUpload}
                className="text-red-500 hover:text-red-700"
                title="Cancel upload"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
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

      {showUploadModal && <UploadModal />}
    </div>
  );
}