"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FiTrash2, FiAlertTriangle, FiCheckSquare, FiSquare, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface TrashItem {
  id: string;
  filePath: string;
  fileName: string;
  fileType: string;
  deletedAt: { seconds: number; nanoseconds: number };
  expiresAt: { seconds: number; nanoseconds: number };
  username: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const msBtn = (variant: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  border: variant === 'ghost' ? '1px solid var(--ms-neutral-30)' : 'none',
  borderRadius: 4, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
  background: variant === 'primary' ? 'var(--ms-blue)' : variant === 'danger' ? 'var(--ms-red)' : '#fff',
  color: variant === 'ghost' ? 'var(--ms-neutral-110)' : '#fff',
  transition: 'background var(--transition-fast)',
});

export default function TrashBin() {
  const { user } = useAuth();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/users/current');
        if (response.ok) {
          const userData = await response.json();
          setUserRole(userData.role || 'viewer');
        }
      } catch (error) { console.error('Error fetching user role:', error); }
    };
    if (user) fetchUserRole();
  }, [user]);

  const isAdmin = user?.email === 'admin@kayodefilani.com';

  const fetchTrashItems = async (page = 1, limit = 10) => {
    try {
      setLoading(true); setError(null);
      const response = await fetch(`/api/trash?page=${page}&limit=${limit}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch trash items');
      setTrashItems(data.trashItems);
      setPagination({ total: data.total, page: data.page, limit: data.limit, totalPages: data.totalPages });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchTrashItems(); }, [user]);

  const handleDelete = async (trashId: string) => {
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    try {
      setDeleting(trashId);
      const response = await fetch(`/api/trash?id=${trashId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete item');
      fetchTrashItems(pagination.page, pagination.limit);
      toast.success('Item permanently deleted');
    } catch (err) {
      toast.error('Failed to delete item');
    } finally { setDeleting(null); }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Permanently delete ${selectedItems.length} item(s)? This cannot be undone.`)) return;
    try {
      setBulkDeleting(true);
      await Promise.all(selectedItems.map(id => fetch(`/api/trash?id=${id}`, { method: 'DELETE' })));
      fetchTrashItems(pagination.page, pagination.limit);
      setSelectedItems([]); setIsMultiSelectMode(false);
      toast.success(`${selectedItems.length} item(s) permanently deleted`);
    } catch { toast.error('Failed to delete some items'); } 
    finally { setBulkDeleting(false); }
  };

  const toggleItemSelection = (itemId: string) =>
    setSelectedItems(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);

  const handleSelectAll = () =>
    setSelectedItems(selectedItems.length === trashItems.length ? [] : trashItems.map(i => i.id));

  const formatDate = (ts: { seconds: number }) => new Date(ts.seconds * 1000).toLocaleString();
  const getDaysRemaining = (expiresAt: { seconds: number }) => {
    const diff = new Date(expiresAt.seconds * 1000).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (!user || !isAdmin) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <div style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--ms-neutral-20)', padding: '40px', textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
          <FiAlertTriangle style={{ width: 40, height: 40, color: 'var(--ms-orange)', marginBottom: 16 }} />
          <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Access Denied</h2>
          <p style={{ margin: 0, color: 'var(--ms-neutral-90)', fontSize: 13 }}>Only administrators can access the Recycle Bin.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ms-neutral-160)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiTrash2 style={{ color: 'var(--ms-neutral-60)' }} /> Recycle Bin
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ms-neutral-60)' }}>
            {pagination.total} item{pagination.total !== 1 ? 's' : ''} — auto-deleted after 30 days
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={msBtn('ghost')} onClick={() => fetchTrashItems(pagination.page, pagination.limit)}>
            <FiRefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button
            style={{ ...msBtn('ghost'), background: isMultiSelectMode ? 'var(--ms-blue-light)' : '#fff', borderColor: isMultiSelectMode ? 'var(--ms-blue)' : 'var(--ms-neutral-30)', color: isMultiSelectMode ? 'var(--ms-blue)' : 'var(--ms-neutral-110)' }}
            onClick={() => { setIsMultiSelectMode(!isMultiSelectMode); setSelectedItems([]); }}
          >
            {isMultiSelectMode ? <FiCheckSquare size={14} /> : <FiSquare size={14} />} Select
          </button>
          {isMultiSelectMode && selectedItems.length > 0 && (
            <button style={msBtn('danger')} onClick={handleBulkDelete} disabled={bulkDeleting}>
              <FiTrash2 size={14} /> Delete ({selectedItems.length})
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--ms-neutral-30)', borderTopColor: 'var(--ms-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ms-red)' }}>
          <p>{error}</p>
          <button style={msBtn('ghost')} onClick={() => fetchTrashItems()}>Retry</button>
        </div>
      ) : trashItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FiTrash2 style={{ width: 48, height: 48, color: 'var(--ms-neutral-40)', marginBottom: 16 }} />
          <p style={{ color: 'var(--ms-neutral-60)', fontSize: 14 }}>Recycle Bin is empty</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--ms-neutral-20)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: isMultiSelectMode ? '40px 2fr 1fr 1fr 1fr 1fr 80px' : '2fr 1fr 1fr 1fr 1fr 80px', padding: '10px 16px', background: 'var(--ms-neutral-10)', borderBottom: '1px solid var(--ms-neutral-20)', fontSize: 11, fontWeight: 700, color: 'var(--ms-neutral-90)', textTransform: 'uppercase', letterSpacing: '0.05em', alignItems: 'center', gap: 8 }}>
            {isMultiSelectMode && (
              <button onClick={handleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-blue)', padding: 0, display: 'flex' }}>
                {selectedItems.length === trashItems.length ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}
              </button>
            )}
            <span>Name</span><span>Type</span><span>Deleted By</span><span>Deleted At</span><span>Expires In</span><span>Actions</span>
          </div>

          {/* Table rows */}
          {trashItems.map(item => {
            const days = getDaysRemaining(item.expiresAt);
            const isSelected = selectedItems.includes(item.id);
            return (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMultiSelectMode ? '40px 2fr 1fr 1fr 1fr 1fr 80px' : '2fr 1fr 1fr 1fr 1fr 80px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--ms-neutral-10)',
                  alignItems: 'center',
                  gap: 8,
                  background: isSelected ? 'var(--ms-blue-light)' : 'transparent',
                  fontSize: 13,
                  color: 'var(--ms-neutral-110)',
                  transition: 'background var(--transition-fast)',
                  cursor: isMultiSelectMode ? 'pointer' : 'default',
                }}
                onClick={() => isMultiSelectMode && toggleItemSelection(item.id)}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--ms-neutral-10)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {isMultiSelectMode && (
                  <div style={{ color: 'var(--ms-blue)', display: 'flex' }}>
                    {isSelected ? <FiCheckSquare size={16} /> : <FiSquare size={16} />}
                  </div>
                )}
                <span style={{ fontWeight: 500, color: 'var(--ms-neutral-160)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.fileName}</span>
                <span style={{ color: 'var(--ms-neutral-60)', fontSize: 12 }}>{item.fileType}</span>
                <span>{item.username}</span>
                <span style={{ fontSize: 12 }}>{formatDate(item.deletedAt)}</span>
                <span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: days <= 3 ? '#fde7e7' : days <= 7 ? '#fff4ce' : 'var(--ms-neutral-10)',
                    color: days <= 3 ? 'var(--ms-red)' : days <= 7 ? 'var(--ms-orange)' : 'var(--ms-neutral-90)',
                  }}>
                    {days}d
                  </span>
                </span>
                <div onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-red)', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', opacity: deleting === item.id ? 0.5 : 1 }}
                    title="Delete permanently"
                  >
                    {deleting === item.id ? <div style={{ width: 14, height: 14, border: '2px solid var(--ms-red)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : <FiTrash2 size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '10px 0', fontSize: 13, color: 'var(--ms-neutral-90)' }}>
          <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={msBtn('ghost')} onClick={() => fetchTrashItems(pagination.page - 1, pagination.limit)} disabled={pagination.page === 1}>Previous</button>
            <button style={msBtn('ghost')} onClick={() => fetchTrashItems(pagination.page + 1, pagination.limit)} disabled={pagination.page === pagination.totalPages}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}