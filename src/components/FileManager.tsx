'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, uploadBytesResumable, listAll, getDownloadURL, deleteObject, UploadTaskSnapshot, UploadTask, getMetadata, getBlob, updateMetadata } from 'firebase/storage';
import { storage, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { FiFolder, FiFile, FiImage, FiFileText, FiArchive, FiVideo, FiMusic, FiCode, FiGrid, FiList, FiSearch, FiUpload, FiFolderPlus, FiTrash2, FiRefreshCw, FiDownload, FiEdit2, FiLock, FiUnlock, FiChevronRight, FiHome, FiMoreVertical, FiCheckSquare, FiSquare, FiX, FiSave, FiEye } from 'react-icons/fi';
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

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

function FileManager() {
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
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<'none' | 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'scanned_documents' | 'invoices_billing' | 'certificate_of_occupancy' | 'evidence_files' | 'property_ownership' | 'title_deeds' | 'lease_agreements' | 'land_use_files'>('none');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const fileListRef = useRef<HTMLDivElement>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchHighlightIndex, setSearchHighlightIndex] = useState(-1);
  const searchGenRef = useRef(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Context Menu Logic ──
  const handleMenuOpen = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenPath(item.path);
    
    // Adjust position to prevent screen cutoff
    const menuWidth = 180;
    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX;
    const y = e.clientY;
    
    setMenuAnchor({ x, y });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenPath(null);
        setMenuAnchor(null);
      }
    };
    if (menuOpenPath) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpenPath]);

  const handleDelete = async (item: FileItem) => {
    if (!isAdmin && item.type === 'folder') {
      toast.error('Only admins can delete folders');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this ${item.type}?`)) return;

    try {
      if (item.type === 'file') {
        const fileRef = ref(storage, item.path);
        await deleteObject(fileRef);
        // Also delete from Firestore if it exists
        const fileDocId = item.path.replace(/\//g, '_');
        const fileDocRef = doc(db, 'files', fileDocId);
        try {
          await deleteDoc(fileDocRef);
        } catch (e) { /* ignore if not in firestore */ }
      } else {
        // Recursive folder deletion (Note: listAll only gets direct children)
        // For a full recursive delete in Storage, we'd need a more complex crawl.
        // For this app's depth, let's at least delete placeholder and direct items.
        const folderRef = ref(storage, item.path);
        const result = await listAll(folderRef);
        
        const deletePromises = result.items.map(i => deleteObject(i));
        await Promise.all(deletePromises);
        
        // Delete folder metadata from Firestore
        const folderDocId = item.path.replace(/\//g, '_');
        const folderDocRef = doc(db, 'folders', folderDocId);
        try {
          await deleteDoc(folderDocRef);
        } catch (e) { /* ignore */ }
      }
      toast.success(`${item.type === 'file' ? 'File' : 'Folder'} deleted successfully`);
      loadFiles();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleRename = async (item: FileItem) => {
    const newName = window.prompt(`Enter new name for ${item.name}:`, item.name);
    if (!newName || newName === item.name) return;

    try {
      const itemDocId = item.path.replace(/\//g, '_');
      const collectionName = item.type === 'file' ? 'files' : 'folders';
      const docRef = doc(db, collectionName, itemDocId);
      
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, { name: newName });
      } else {
        // If not in firestore, create the entry or use storage metadata
        const storageRef = ref(storage, item.path);
        await updateMetadata(storageRef, { customMetadata: { ...(await getMetadata(storageRef)).customMetadata, displayName: newName } });
      }
      
      toast.success('Renamed successfully');
      loadFiles();
    } catch (error) {
      console.error('Rename error:', error);
      toast.error('Failed to rename item');
    }
  };

  const handleGetLink = async (item: FileItem) => {
    if (item.type === 'folder') return;
    try {
      let url = item.url;
      if (!url) {
        url = await getDownloadURL(ref(storage, item.path));
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} selected items?`)) return;

    setUploading(true);
    try {
      for (const path of selectedItems) {
        // Find item in local state or ref from storage
        const item = files.find(f => f.path === path) || searchResults.find(f => f.path === path);
        if (item) {
          const fileRef = ref(storage, item.path);
          await deleteObject(fileRef);
          const itemDocId = item.path.replace(/\//g, '_');
          await deleteDoc(doc(db, item.type === 'file' ? 'files' : 'folders', itemDocId)).catch(() => {});
        } else {
          // Fallback if item not in state (e.g. from search results not in files)
          await deleteObject(ref(storage, path)).catch(() => {});
        }
      }
      toast.success('Selected items deleted');
      setSelectedItems([]);
      loadFiles();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Error during bulk deletion');
    } finally {
      setUploading(false);
    }
  };


  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

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
      
      const result = await listAll(folderRef);
      
      const filePromises = result.items.map(async (item) => {
        try {
          const url = await getDownloadURL(item);
          const metadata = await getMetadata(item);
          
          let folderCategory: 'contracts' | 'case_files' | 'court_filings' | 'legal_memos' | 'briefs' | 'client_correspondence' | 'evidence_documents' | 'scanned_documents' | 'invoices_billing' = 'contracts';
          if (currentFolder) {
            const placeholderRef = ref(storage, `files/${currentFolder}/.placeholder`);
            try {
              const folderMetadata = await getMetadata(placeholderRef);
              folderCategory = (folderMetadata.customMetadata?.category as any) || 'contracts';
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
            category: metadata.customMetadata?.category as any || folderCategory
          };
          return fileItem;
        } catch (error) {
          console.error('Error processing file:', error);
          return null;
        }
      });
      
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
              category: metadata.customMetadata?.category as any,
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
      
      const [filesData, folders] = await Promise.all([
        Promise.all(filePromises),
        Promise.all(folderPromises)
      ]);
      
      const validFiles = filesData.filter((file): file is FileItem => file !== null);
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

  // ── Search: two-phase (instant local + async deep Firebase) ──
  const handleSearch = useCallback(async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Bump generation so stale async callbacks are discarded
    const gen = ++searchGenRef.current;

    // Phase 1 – instant: filter already-loaded files
    const localMatches = files.filter(f =>
      f.name !== '.placeholder' &&
      (f.name.toLowerCase().includes(q) ||
        (f.category?.toLowerCase().includes(q) ?? false))
    );
    setSearchResults(localMatches);
    setSearchHighlightIndex(-1);

    // Phase 2 – async: deep crawl Firebase Storage for results outside current folder
    setIsSearching(true);
    try {
      const collected: FileItem[] = [];
      const seen = new Set(localMatches.map(f => f.path));

      // Run tasks in batches to avoid overwhelming the browser connection pool
      // Note: trailing comma after T is required in .tsx to avoid JSX ambiguity
      const runBatched = async <T,>(tasks: (() => Promise<T>)[], batchSize = 5): Promise<T[]> => {
        const results: T[] = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
          const batch = tasks.slice(i, i + batchSize).map(t => t());
          results.push(...await Promise.all(batch));
          if (gen !== searchGenRef.current) return results; // abort if stale
        }
        return results;
      };

      const crawl = async (folderPath: string): Promise<void> => {
        if (gen !== searchGenRef.current) return;
        const folderRef = ref(storage, folderPath);
        const result = await listAll(folderRef);

        // Process files in batches — NO getDownloadURL here, only getMetadata
        // URL is fetched lazily when the user actually clicks to open the file
        const fileTasks = result.items
          .filter(item => item.name !== '.placeholder' && !seen.has(item.fullPath))
          .map(item => async () => {
            const nameLower = item.name.toLowerCase();
            try {
              const metadata = await getMetadata(item);
              const catLower = metadata.customMetadata?.category?.toLowerCase() || '';
              if ((nameLower.includes(q) || catLower.includes(q)) && !seen.has(item.fullPath)) {
                seen.add(item.fullPath);
                collected.push({
                  name: item.name,
                  url: '', // fetched lazily on click
                  path: item.fullPath,
                  type: 'file',
                  parentFolder: folderPath.replace(/^files\/?/, ''),
                  size: metadata.size,
                  lastModified: metadata.updated ? new Date(metadata.updated).getTime() : undefined,
                  category: metadata.customMetadata?.category as FileItem['category'],
                });
              }
            } catch { /* skip inaccessible */ }
          });
        await runBatched(fileTasks);

        // Process subfolders in batches
        const folderTasks = result.prefixes.map(prefix => async () => {
          const folderNameLower = prefix.name.toLowerCase();
          let folderCategory = '';
          let isLocked = false;
          let lockedBy = '';
          let lockedAt = '';
          try {
            const pm = await getMetadata(ref(storage, `${prefix.fullPath}/.placeholder`));
            folderCategory = pm.customMetadata?.category || '';
            isLocked = pm.customMetadata?.isLocked === 'true';
            lockedBy = pm.customMetadata?.lockedBy || '';
            lockedAt = pm.customMetadata?.lockedAt || '';
          } catch { /* no placeholder */ }

          if ((folderNameLower.includes(q) || folderCategory.toLowerCase().includes(q)) && !seen.has(prefix.fullPath)) {
            seen.add(prefix.fullPath);
            collected.push({
              name: prefix.name,
              url: '',
              path: prefix.fullPath,
              type: 'folder',
              parentFolder: prefix.fullPath.replace(`/${prefix.name}`, '').replace(/^files\/?/, ''),
              category: folderCategory as FileItem['category'],
              isLocked, lockedBy, lockedAt,
            });
          }
          await crawl(prefix.fullPath);
        });
        await runBatched(folderTasks, 3);
      };

      await crawl('files');

      if (gen !== searchGenRef.current) return; // stale — discard

      setSearchResults(prev => {
        const existingPaths = new Set(prev.map(f => f.path));
        const newItems = collected.filter(f => !existingPaths.has(f.path));
        return [...prev, ...newItems];
      });
    } catch (err) {
      console.error('Deep search error:', err);
    } finally {
      if (gen === searchGenRef.current) setIsSearching(false);
    }
  }, [files]);

  const debouncedSearch = useCallback(
    debounce((query: string) => { handleSearch(query); }, 400),
    [handleSearch]
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
      setShowSearchDropdown(true);
    } else {
      setSearchResults([]);
      setIsSearching(false);
      setShowSearchDropdown(false);
    }
  }, [searchQuery, debouncedSearch]);

  // Close dropdown when clicking outside search container
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const { isAdmin, canDownload, canLock } = getUserPermissions(user?.email, userRole);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <FiImage className="w-full h-full" />;
      case 'pdf':
        return <FiFileText className="w-full h-full" />;
      case 'doc':
      case 'docx':
        return <FiFileText className="w-full h-full" />;
      case 'xls':
      case 'xlsx':
        return <FiFileText className="w-full h-full" />;
      case 'ppt':
      case 'pptx':
        return <FiFileText className="w-full h-full" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FiArchive className="w-full h-full" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <FiVideo className="w-full h-full" />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <FiMusic className="w-full h-full" />;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'html':
      case 'css':
        return <FiCode className="w-full h-full" />;
      default:
        return <FiFile className="w-full h-full" />;
    }
  };

  const getFileColor = (item: FileItem) => {
    if (item.type === 'folder') return 'text-blue-500';
    const extension = item.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'text-red-500';
      case 'doc':
      case 'docx': return 'text-blue-600';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp': return 'text-purple-500';
      case 'mp4':
      case 'avi':
      case 'mov': return 'text-pink-500';
      case 'mp3':
      case 'wav':
      case 'ogg': return 'text-green-500';
      case 'zip':
      case 'rar':
      case '7z': return 'text-orange-500';
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'html':
      case 'css': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const getCategoryBadge = (category: any) => {
    const badges: any = {
      contracts: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      case_files: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      court_filings: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      legal_memos: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
      evidence_files: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      title_deeds: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
      lease_agreements: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
      briefs: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
      scanned_documents: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
      invoices_billing: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    };
    
    const badge = badges[category] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
        {category ? category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'None'}
      </span>
    );
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

  const navigateUp = async () => {
    try {
      if (!currentFolder) {
        return;
      }
      
      setSelectedCategory('all');
      
      const parentPath = currentFolder.split('/').slice(0, -1).join('/');
      
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
      }
      setCurrentFolder(parentPath);
    } catch (error) {
      console.error('Error navigating up:', error);
      toast.error('Failed to navigate up');
    }
  };

  const handleFileClick = async (file: FileItem) => {
    if (file.type === 'folder') {
      handleFolderClick(file);
    } else {
      if (showCategoryDropdown === file.path) {
        return;
      }
      try {
        setIsPreviewLoading(true);
        try {
          const response = await fetch('/api/file-access-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: file.path, displayName: user?.displayName || null }),
          });
          if (!response.ok) console.error('Failed to record file access history:', await response.text());
        } catch (historyError) {
          console.error('Error recording file access history:', historyError);
        }

        // Search results have url='' — fetch it lazily now that the user actually wants to open it
        let fileToPreview = file;
        if (!file.url) {
          try {
            const url = await getDownloadURL(ref(storage, file.path));
            fileToPreview = { ...file, url };
          } catch (urlError) {
            console.error('Error fetching file URL:', urlError);
            toast.error('Could not load file URL');
            setIsPreviewLoading(false);
            return;
          }
        }

        setPreviewFile(fileToPreview);
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsPreviewLoading(false);
      } catch (error) {
        console.error('Error accessing file:', error);
        toast.error('Failed to access file');
        setIsPreviewLoading(false);
      }
    }
  };

  const handleFolderClick = async (folder: FileItem) => {
    try {
      if (folder.isLocked && !isAdmin && !canLock) {
        toast.error('This folder is locked and cannot be accessed');
        return;
      }

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
      }

      setSelectedCategory('all');

      const safePath = folder.path.startsWith('files/') ? folder.path.replace('files/', '') : folder.path;
      setCurrentFolder(safePath);
      
      setCurrentPage(1);
      
      const folderRef = ref(storage, folder.path);
      const result = await listAll(folderRef);
      
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
          category: metadata.customMetadata?.category as any
        };
      });

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

      const [filesData, folders] = await Promise.all([
        Promise.all(filePromises),
        Promise.all(folderPromises)
      ]);

      const validFolders = folders.filter(folder => folder !== null) as FileItem[];
      const allItems = [...filesData, ...validFolders];
      
      setFiles(allItems);
      setAllFiles(allItems);
      
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
    } catch (error) {
      console.error('Error accessing folder:', error);
      toast.error('Failed to access folder');
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }

    const sanitizedFolderName = newFolderName.trim().replace(/[^a-zA-Z0-9-_ ]/g, '');

    if (!sanitizedFolderName) {
      toast.error('Invalid folder name');
      return;
    }

    try {
      const folderPath = currentFolder ? `files/${currentFolder}/${sanitizedFolderName}` : `files/${sanitizedFolderName}`;
      
      const placeholderPath = `${folderPath}/.placeholder`;
      const placeholderRef = ref(storage, placeholderPath);
      
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
      
      window.dispatchEvent(new Event('folderCreated'));
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleRefresh = () => {
    loadFiles();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setShowUploadModal(false);

    let completedFiles = 0;
    const totalFiles = selectedFiles.length;
    let totalBytesUploaded = 0;
    const totalBytesToUpload = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    setTotalSize(totalBytesToUpload);

    const startTime = Date.now();

    for (const file of selectedFiles) {
      const storageRef = ref(storage, currentFolder ? `files/${currentFolder}/${file.name}` : `files/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        customMetadata: {
          category: uploadCategory,
          uploadedBy: user?.email || 'unknown',
          uploadedAt: new Date().toISOString()
        }
      });

      setUploadTasks(prev => [...prev, uploadTask]);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          // Calculate overall progress across all files
          const currentFileProgress = snapshot.bytesTransferred;
          const overallProgress = ((totalBytesUploaded + currentFileProgress) / totalBytesToUpload) * 100;
          setUploadProgress(overallProgress);
          lastUploadedBytes.current = totalBytesUploaded + currentFileProgress;

          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed > 0) {
            const speed = lastUploadedBytes.current / elapsed;
            setUploadSpeed(speed);
            const remaining = (totalBytesToUpload - lastUploadedBytes.current) / speed;
            setTimeRemaining(remaining);
          }
        },
        (error) => {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
        },
        async () => {
          totalBytesUploaded += file.size;
          completedFiles++;
          if (completedFiles === totalFiles) {
            setUploading(false);
            setUploadTasks([]);
            setSelectedFiles([]);
            setUploadProgress(0);
            toast.success('All files uploaded successfully');
            loadFiles();
          }
        }
      );
    }
  };

  const filteredItems = (searchQuery ? searchResults : files).filter(item => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setTotalPages(Math.ceil(filteredItems.length / itemsPerPage));
  }, [files, searchResults, searchQuery, selectedCategory, itemsPerPage, filteredItems.length]);

  // Wrap matched substring in a bold span
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.trim().toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong style={{ color: 'var(--ms-blue)', fontWeight: 700 }}>{text.slice(idx, idx + query.trim().length)}</strong>
        {text.slice(idx + query.trim().length)}
      </>
    );
  };

  const fluentBtn = (variant: 'primary'|'ghost'|'danger'|'ghost-active', small = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: small ? '5px 10px' : '6px 12px',
    border: variant === 'primary' || variant === 'danger' ? 'none' : '1px solid var(--ms-neutral-30)',
    borderRadius: 4, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
    background: variant === 'primary' ? 'var(--ms-blue)' : variant === 'danger' ? 'var(--ms-red)' : variant === 'ghost-active' ? 'var(--ms-blue-light)' : '#fff',
    color: variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'ghost-active' ? 'var(--ms-blue)' : 'var(--ms-neutral-110)',
    borderColor: variant === 'ghost-active' ? 'var(--ms-blue)' : undefined,
    whiteSpace: 'nowrap' as 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top Bar ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid var(--ms-neutral-20)',
        position: 'sticky', top: 0, zIndex: 20, padding: '0 24px',
      }}>
        {/* Row 1: Title + Search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ms-neutral-160)', whiteSpace: 'nowrap' }}>Files</h1>
            <FiChevronRight style={{ width: 14, height: 14, color: 'var(--ms-neutral-40)', flexShrink: 0 }} />
            {/* Breadcrumb */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, minWidth: 0, flexWrap: 'wrap' }}>
              <button onClick={() => setCurrentFolder('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 3, color: 'var(--ms-neutral-90)', display: 'flex', alignItems: 'center', fontFamily: 'inherit' }}>
                <FiHome style={{ width: 14, height: 14 }} />
              </button>
              {currentFolder && currentFolder.split('/').map((folder, index, array) => {
                const path = array.slice(0, index + 1).join('/');
                return (
                  <React.Fragment key={index}>
                    <FiChevronRight style={{ width: 14, height: 14, color: 'var(--ms-neutral-40)', flexShrink: 0 }} />
                    <button onClick={() => setCurrentFolder(path)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 3, color: index === array.length - 1 ? 'var(--ms-neutral-160)' : 'var(--ms-blue)', fontWeight: index === array.length - 1 ? 600 : 400, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{folder}</button>
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Search */}
          <div ref={searchContainerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ms-neutral-60)', width: 14, height: 14, zIndex: 1, pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search files and folders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery.trim()) setShowSearchDropdown(true); }}
              onKeyDown={e => {
                if (!showSearchDropdown) return;
                const total = Math.min(searchResults.length, 30);
                if (e.key === 'ArrowDown') { e.preventDefault(); setSearchHighlightIndex(i => Math.min(i + 1, total - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchHighlightIndex(i => Math.max(i - 1, 0)); }
                else if (e.key === 'Escape') { setShowSearchDropdown(false); setSearchQuery(''); }
                else if (e.key === 'Enter' && searchHighlightIndex >= 0) {
                  const item = searchResults[searchHighlightIndex];
                  if (item) { setShowSearchDropdown(false); setSearchQuery(''); if (item.type === 'folder') handleFolderClick(item); else handleFileClick(item); }
                }
              }}
              style={{ paddingLeft: 32, paddingRight: isSearching ? 30 : searchQuery ? 30 : 12, paddingTop: 7, paddingBottom: 7, width: 320, border: '1px solid', borderColor: showSearchDropdown && searchResults.length > 0 ? 'var(--ms-blue)' : 'var(--ms-neutral-30)', borderRadius: showSearchDropdown && searchResults.length > 0 ? '20px 20px 0 0' : 20, borderBottom: showSearchDropdown && searchResults.length > 0 ? 'none' : undefined, fontSize: 13, color: 'var(--ms-neutral-160)', outline: 'none', fontFamily: 'inherit', background: '#fff', transition: 'border-color 0.15s' }}
            />
            {/* Clear button */}
            {searchQuery && !isSearching && (
              <button
                onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', display: 'flex', padding: 0 }}
              >
                <FiX style={{ width: 14, height: 14 }} />
              </button>
            )}
            {isSearching && (
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--ms-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            )}

            {/* ── Spotlight Dropdown ── */}
            {showSearchDropdown && searchQuery.trim() && (
              <div style={{ position: 'absolute', top: 'calc(100% - 1px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--ms-blue)', borderTop: '1px solid var(--ms-neutral-20)', borderRadius: '0 0 12px 12px', boxShadow: '0 8px 24px rgba(0,0,0,.13)', zIndex: 500, overflow: 'hidden', maxHeight: 440, display: 'flex', flexDirection: 'column' }}>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {searchResults.length === 0 && !isSearching && (
                    <div style={{ padding: '18px 16px', textAlign: 'center', color: 'var(--ms-neutral-60)', fontSize: 13 }}>
                      No results for <strong style={{ color: 'var(--ms-neutral-160)' }}>"{searchQuery}"</strong>
                    </div>
                  )}
                  {searchResults.slice(0, 30).map((item, i) => {
                    const isHl = i === searchHighlightIndex;
                    const parentLabel = item.parentFolder ? item.parentFolder.split('/').join(' › ') : 'Root';
                    return (
                      <div
                        key={item.path}
                        onMouseEnter={() => setSearchHighlightIndex(i)}
                        onMouseLeave={() => setSearchHighlightIndex(-1)}
                        onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); if (item.type === 'folder') handleFolderClick(item); else handleFileClick(item); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', background: isHl ? 'var(--ms-blue-light)' : 'transparent', borderBottom: '1px solid var(--ms-neutral-10)', transition: 'background 0.1s' }}
                      >
                        <div style={{ width: 20, height: 20, flexShrink: 0 }} className={getFileColor(item)}>
                          {item.type === 'folder'
                            ? <FaFolder style={{ width: 20, height: 20, color: '#FFB900' }} />
                            : getFileIcon(item.name)}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ms-neutral-160)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {highlightText(item.name, searchQuery)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ms-neutral-60)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📁 {parentLabel}
                          </div>
                        </div>
                        <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--ms-neutral-60)', background: 'var(--ms-neutral-10)', borderRadius: 4, padding: '2px 6px' }}>
                          {item.type === 'folder' ? 'Folder' : (item.name.split('.').pop()?.toUpperCase() || 'File')}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Footer */}
                <div style={{ padding: '6px 14px', borderTop: '1px solid var(--ms-neutral-20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--ms-neutral-60)', background: 'var(--ms-neutral-10)', flexShrink: 0 }}>
                  <span>{isSearching ? 'Searching all folders…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}</span>
                  <span style={{ opacity: 0.6 }}>↑↓ navigate · Enter open · Esc close</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Command Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAdmin && (
              <>
                {currentFolder ? (
                  <button onClick={() => setShowUploadModal(true)} style={fluentBtn('primary')}>
                    <FiUpload style={{ width: 13, height: 13 }} /> Upload
                  </button>
                ) : (
                  <button onClick={() => setShowNewFolderInput(true)} style={fluentBtn('primary')}>
                    <FiFolderPlus style={{ width: 13, height: 13 }} /> New folder
                  </button>
                )}

                <span style={{ width: 1, height: 20, background: 'var(--ms-neutral-30)', margin: '0 4px' }} />

                <button onClick={() => setIsMultiSelectMode(!isMultiSelectMode)} style={fluentBtn(isMultiSelectMode ? 'ghost-active' : 'ghost')}>
                  {isMultiSelectMode ? <FiCheckSquare style={{ width: 13, height: 13 }} /> : <FiSquare style={{ width: 13, height: 13 }} />} Select
                </button>

                {selectedItems.length > 0 && (
                  <button onClick={handleBulkDelete} style={fluentBtn('danger')}>
                    <FiTrash2 style={{ width: 13, height: 13 }} /> Delete ({selectedItems.length})
                  </button>
                )}
              </>
            )}

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as any)}
              style={{ padding: '5px 10px', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, fontSize: 13, color: 'var(--ms-neutral-110)', fontFamily: 'inherit', background: '#fff', cursor: 'pointer', outline: 'none' }}
            >
              <option value="all">All files</option>
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
                </>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* View mode toggle */}
            {(['grid', 'list'] as ('grid'|'list')[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{ padding: '5px', borderRadius: 4, border: 'none', cursor: 'pointer', background: viewMode === mode ? 'var(--ms-blue-light)' : 'transparent', color: viewMode === mode ? 'var(--ms-blue)' : 'var(--ms-neutral-90)' }}>
                {mode === 'grid' ? <FiGrid style={{ width: 16, height: 16 }} /> : <FiList style={{ width: 16, height: 16 }} />}
              </button>
            ))}
            <span style={{ width: 1, height: 20, background: 'var(--ms-neutral-30)', margin: '0 4px' }} />
            <button onClick={handleRefresh} disabled={isRefreshing}
              style={{ padding: 5, borderRadius: 4, border: 'none', cursor: isRefreshing ? 'wait' : 'pointer', background: 'transparent', color: 'var(--ms-neutral-90)', animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }}>
              <FiRefreshCw style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, padding: '20px 24px', background: 'var(--ms-background)' }}>
        {viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {paginatedItems.length > 0 ? (
              paginatedItems.map(item => {
                const isSelected = selectedItems.includes(item.path);
                return (
                  <div
                    key={item.path}
                    onClick={e => isMultiSelectMode ? toggleSelectItem(item.path, e) : handleFileClick(item)}
                    style={{
                      background: '#fff', borderRadius: 4, border: `2px solid ${isSelected ? 'var(--ms-blue)' : 'transparent'}`,
                      padding: 12, cursor: 'pointer', position: 'relative',
                      boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; if (!isSelected) e.currentTarget.style.borderColor = 'var(--ms-neutral-30)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; if (!isSelected) e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    {isMultiSelectMode && (
                      <div style={{ position: 'absolute', top: 6, left: 6, width: 16, height: 16, borderRadius: 3, border: `2px solid ${isSelected ? 'var(--ms-blue)' : 'var(--ms-neutral-40)'}`, background: isSelected ? 'var(--ms-blue)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    )}

                    {/* Icon */}
                    <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {item.type === 'folder' ? (
                        <>
                          <FaFolder style={{ width: 48, height: 48, color: '#FFB900' }} />
                          {item.isLocked && isAdmin && (
                            <FiLock style={{ position: 'absolute', bottom: -2, right: -4, width: 14, height: 14, color: 'var(--ms-red)', background: '#fff', borderRadius: 2 }} />
                          )}
                        </>
                      ) : (
                        <div style={{ width: 40, height: 40 }} className={getFileColor(item)}>
                          {getFileIcon(item.name)}
                        </div>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--ms-neutral-160)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', width: '100%', wordBreak: 'break-word' }}>
                      {item.name}
                    </p>

                    {item.type === 'folder' ? (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--ms-neutral-60)' }}>Folder</p>
                    ) : item.size ? (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--ms-neutral-60)' }}>{formatBytes(item.size)}</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--ms-neutral-60)' }}>—</p>
                    )}

                    {item.category && (
                      <div style={{ marginTop: 2 }}>
                        {getCategoryBadge(item.category)}
                      </div>
                    )}

                    {/* Context Menu Button for Grid */}
                    <button 
                      onClick={e => handleMenuOpen(e, item)}
                      style={{ 
                        position: 'absolute', top: 4, right: 4, 
                        background: 'none', border: 'none', cursor: 'pointer', 
                        color: 'var(--ms-neutral-60)', padding: 4, borderRadius: 4,
                        opacity: menuOpenPath === item.path ? 1 : 0,
                        transition: 'opacity 0.2s',
                        zIndex: 5
                      }}
                      className="grid-more-btn"
                    >
                      <FiMoreVertical style={{ width: 14, height: 14 }} />
                    </button>
                    <style jsx>{`
                      div:hover .grid-more-btn { opacity: 1 !important; }
                    `}</style>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'var(--ms-neutral-60)', fontSize: 14 }}>
                {searchQuery ? 'No matching files or folders found' : 'This folder is empty'}
              </div>
            )}
          </div>
        ) : (
          /* List view */
          <div style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--ms-neutral-20)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: `${isMultiSelectMode ? '40px ' : ''}2fr 1fr 1fr 1fr 40px`, padding: '10px 16px', background: 'var(--ms-neutral-10)', borderBottom: '1px solid var(--ms-neutral-20)', fontSize: 11, fontWeight: 700, color: 'var(--ms-neutral-90)', textTransform: 'uppercase', letterSpacing: '0.05em', gap: 8, alignItems: 'center' }}>
              {isMultiSelectMode && <span />}
              <span>Name</span><span>Category</span><span>Modified</span><span>Size</span><span />
            </div>
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item, i) => {
                const isSelected = selectedItems.includes(item.path);
                return (
                  <div
                    key={item.path}
                    onClick={e => isMultiSelectMode ? toggleSelectItem(item.path, e) : handleFileClick(item)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `${isMultiSelectMode ? '40px ' : ''}2fr 1fr 1fr 1fr 40px`,
                      padding: '11px 16px', gap: 8, alignItems: 'center',
                      borderBottom: i < paginatedItems.length - 1 ? '1px solid var(--ms-neutral-10)' : 'none',
                      background: isSelected ? 'var(--ms-blue-light)' : 'transparent',
                      cursor: 'pointer', fontSize: 13, color: 'var(--ms-neutral-110)',
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--ms-neutral-10)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {isMultiSelectMode && (
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${isSelected ? 'var(--ms-blue)' : 'var(--ms-neutral-40)'}`, background: isSelected ? 'var(--ms-blue)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                      <div style={{ width: 24, height: 24, flexShrink: 0 }} className={getFileColor(item)}>
                        {item.type === 'folder' ? <FaFolder style={{ width: 24, height: 24, color: '#FFB900' }} /> : getFileIcon(item.name)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 500, color: 'var(--ms-neutral-160)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        {item.isLocked && isAdmin && <FiLock style={{ width: 13, height: 13, color: 'var(--ms-red)', flexShrink: 0 }} />}
                      </div>
                    </div>
                    <div>{item.category && getCategoryBadge(item.category)}</div>
                    <span style={{ fontSize: 12, color: 'var(--ms-neutral-60)' }}>{item.lastModified ? new Date(item.lastModified).toLocaleDateString() : '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--ms-neutral-60)' }}>{item.type === 'folder' ? 'Folder' : (item.size ? formatBytes(item.size) : '—')}</span>
                    <button onClick={e => handleMenuOpen(e, item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', padding: 4, borderRadius: 4 }}>
                      <FiMoreVertical style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ms-neutral-60)', fontSize: 14 }}>
                {searchQuery ? 'No matching files or folders found' : 'This folder is empty'}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, background: '#fff', borderRadius: 6, border: '1px solid var(--ms-neutral-20)', padding: '10px 16px', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ms-neutral-60)' }}>Per page:</span>
              <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} style={{ padding: '4px 8px', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, fontSize: 12, color: 'var(--ms-neutral-110)', fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--ms-neutral-60)' }}>Page {currentPage} of {totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}
                  style={{ ...fluentBtn('ghost', true), opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages}
                  style={{ ...fluentBtn('ghost', true), opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Folder Modal ── */}
      {showNewFolderInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 6, boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 420, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--ms-neutral-20)' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Create new folder</h2>
              <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', padding: 4, borderRadius: 4, display: 'flex' }}><FiX style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 6 }}>Folder name</label>
                <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Enter folder name" autoFocus
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', color: 'var(--ms-neutral-160)', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 6 }}>Category</label>
                <select value={newFolderCategory} onChange={e => setNewFolderCategory(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', color: 'var(--ms-neutral-160)', outline: 'none', cursor: 'pointer' }}>
                  <option value="includes_coo">Includes C of O</option>
                  <option value="without_coo">Without C of O</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} style={fluentBtn('ghost')}>Cancel</button>
                <button onClick={createFolder} style={fluentBtn('primary')}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Progress ── */}
      {uploading && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#fff', padding: 16, borderRadius: 6, boxShadow: 'var(--shadow-lg)', width: 300, border: '1px solid var(--ms-neutral-20)', zIndex: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-160)' }}>Uploading…</span>
            <span style={{ fontSize: 12, color: 'var(--ms-neutral-90)' }}>{Math.round(uploadProgress)}%</span>
          </div>
          <div style={{ background: 'var(--ms-neutral-20)', borderRadius: 2, height: 4, overflow: 'hidden' }}>
            <div style={{ background: 'var(--ms-blue)', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.3s ease', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--ms-neutral-60)' }}>
            <span>{formatBytes(lastUploadedBytes.current)} / {formatBytes(totalSize)}</span>
            {timeRemaining > 0 && <span>{formatTime(timeRemaining)} left</span>}
          </div>
        </div>
      )}

      {/* ── File Preview Modal ── */}
      {previewFile && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 8, boxShadow: 'var(--shadow-lg)', width: '90vw', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--ms-neutral-20)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                <div style={{ width: 22, height: 22, flexShrink: 0 }} className={getFileColor(previewFile)}>
                  {getFileIcon(previewFile.name)}
                </div>
                <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ms-neutral-160)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewFile.name}
                </span>
                {previewFile.size && (
                  <span style={{ fontSize: 12, color: 'var(--ms-neutral-60)', flexShrink: 0 }}>({formatBytes(previewFile.size)})</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {canDownload && (
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...fluentBtn('primary'), textDecoration: 'none', fontSize: 13 }}
                  >
                    <FiDownload style={{ width: 13, height: 13 }} /> Download
                  </a>
                )}
                <button
                  onClick={() => setPreviewFile(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', padding: 4, borderRadius: 4, display: 'flex' }}
                >
                  <FiX style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ms-neutral-10)' }}>
              {isPreviewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--ms-neutral-60)', fontSize: 14 }}>
                  <div style={{ width: 32, height: 32, border: '3px solid var(--ms-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading preview…
                </div>
              ) : (() => {
                const ext = previewFile.name.split('.').pop()?.toLowerCase() || '';
                const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
                const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
                const audioExts = ['mp3', 'wav', 'ogg', 'aac'];

                if (imageExts.includes(ext)) {
                  return (
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 4, boxShadow: 'var(--shadow-md)' }}
                    />
                  );
                }
                if (ext === 'pdf') {
                  return (
                    <iframe
                      src={previewFile.url}
                      title={previewFile.name}
                      style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 4 }}
                    />
                  );
                }
                if (videoExts.includes(ext)) {
                  return (
                    <video controls style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 4 }}>
                      <source src={previewFile.url} />
                      Your browser does not support video playback.
                    </video>
                  );
                }
                if (audioExts.includes(ext)) {
                  return (
                    <audio controls style={{ width: '100%' }}>
                      <source src={previewFile.url} />
                      Your browser does not support audio playback.
                    </audio>
                  );
                }
                // Fallback for unsupported types
                return (
                  <div style={{ textAlign: 'center', color: 'var(--ms-neutral-90)', fontSize: 14 }}>
                    <div style={{ width: 56, height: 56, margin: '0 auto 16px', opacity: 0.4 }} className={getFileColor(previewFile)}>
                      {getFileIcon(previewFile.name)}
                    </div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Preview not available</p>
                    <p style={{ margin: '0 0 20px', color: 'var(--ms-neutral-60)', fontSize: 13 }}>This file type cannot be displayed in the browser.</p>
                    {canDownload && (
                      <a
                        href={previewFile.url}
                        download={previewFile.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ ...fluentBtn('primary'), textDecoration: 'none' }}
                      >
                        <FiDownload style={{ width: 13, height: 13 }} /> Download file
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer meta */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--ms-neutral-20)', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--ms-neutral-60)', flexShrink: 0 }}>
              {previewFile.category && getCategoryBadge(previewFile.category)}
              {previewFile.lastModified && (
                <span>Modified: {new Date(previewFile.lastModified).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── File Upload Modal ── */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 6, boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 500, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--ms-neutral-20)' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Upload files</h2>
              <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', padding: 4, borderRadius: 4, display: 'flex' }}><FiX style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div 
                style={{ 
                  border: '2px dashed var(--ms-neutral-30)', 
                  borderRadius: 6, 
                  padding: '30px 20px', 
                  textAlign: 'center', 
                  background: 'var(--ms-neutral-10)',
                  cursor: 'pointer',
                  marginBottom: 20
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  setSelectedFiles(prev => [...prev, ...files]);
                }}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <FiUpload style={{ width: 32, height: 32, color: 'var(--ms-blue)', marginBottom: 12, opacity: 0.7 }} />
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ms-neutral-160)', fontWeight: 500 }}>Drop files here or click to browse</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ms-neutral-60)' }}>Upload documents to {currentFolder || 'root'}</p>
                <input 
                  id="fileInput" 
                  type="file" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={e => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    setSelectedFiles(prev => [...prev, ...files]);
                  }}
                />
              </div>

              {selectedFiles.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 8 }}>Selected files ({selectedFiles.length})</label>
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--ms-neutral-20)', borderRadius: 4, background: '#fff' }}>
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: idx < selectedFiles.length - 1 ? '1px solid var(--ms-neutral-10)' : 'none', fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          {getFileIcon(file.name)}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        </div>
                        <button 
                          onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-red)', display: 'flex', padding: 4 }}
                        >
                          <FiX style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 6 }}>Category</label>
                <select 
                  value={uploadCategory} 
                  onChange={e => setUploadCategory(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', color: 'var(--ms-neutral-160)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="none">None</option>
                  <option value="contracts">Contracts</option>
                  <option value="case_files">Case Files</option>
                  <option value="court_filings">Court Filings</option>
                  <option value="legal_memos">Legal Memos</option>
                  <option value="briefs">Briefs</option>
                  <option value="scanned_documents">Scanned Documents</option>
                  <option value="invoices_billing">Invoices & Billing</option>
                  <option value="certificate_of_occupancy">Certificate of Occupancy</option>
                  <option value="evidence_files">Evidence Files</option>
                  <option value="client_correspondence">Client Correspondence</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => { setShowUploadModal(false); setSelectedFiles([]); }} style={fluentBtn('ghost')}>Cancel</button>
                <button 
                  onClick={handleUpload} 
                  disabled={selectedFiles.length === 0}
                  style={{ ...fluentBtn('primary'), opacity: selectedFiles.length === 0 ? 0.5 : 1, cursor: selectedFiles.length === 0 ? 'not-allowed' : 'pointer' }}
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* ── Context Menu Popup ── */}
      {menuOpenPath && menuAnchor && (
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuAnchor.y,
            left: menuAnchor.x,
            background: '#fff',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,.15)',
            border: '1px solid var(--ms-neutral-20)',
            padding: '4px 0',
            zIndex: 1000,
            minWidth: 160,
          }}
        >
          {(() => {
            const item = (searchQuery ? searchResults : files).find(f => f.path === menuOpenPath);
            if (!item) return null;
            return (
              <>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ms-neutral-10)', fontSize: 11, fontWeight: 700, color: 'var(--ms-neutral-60)', textTransform: 'uppercase' }}>
                  Actions
                </div>
                <button 
                  onClick={() => { setMenuOpenPath(null); if (item.type === 'folder') handleFolderClick(item); else handleFileClick(item); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ms-neutral-110)', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ms-neutral-10)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <FiEye style={{ width: 14, height: 14 }} /> Open
                </button>
                {item.type === 'file' && (
                  <>
                    <button 
                      onClick={() => { setMenuOpenPath(null); handleGetLink(item); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ms-neutral-110)', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ms-neutral-10)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <FiSave style={{ width: 14, height: 14 }} /> Copy Link
                    </button>
                    {canDownload && (
                      <a 
                        href={item.url} 
                        download={item.name}
                        onClick={() => setMenuOpenPath(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', textDecoration: 'none', color: 'var(--ms-neutral-110)', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--ms-neutral-10)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <FiDownload style={{ width: 14, height: 14 }} /> Download
                      </a>
                    )}
                  </>
                )}
                <button 
                  onClick={() => { setMenuOpenPath(null); handleRename(item); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ms-neutral-110)', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ms-neutral-10)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <FiEdit2 style={{ width: 14, height: 14 }} /> Rename
                </button>
                <div style={{ height: 1, background: 'var(--ms-neutral-10)', margin: '4px 0' }} />
                <button 
                  onClick={() => { setMenuOpenPath(null); handleDelete(item); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ms-red)', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <FiTrash2 style={{ width: 14, height: 14 }} /> Delete
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default FileManager;
