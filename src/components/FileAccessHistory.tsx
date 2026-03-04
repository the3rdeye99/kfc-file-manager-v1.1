'use client';

import { useState, useEffect } from 'react';
import { FiClock, FiUser, FiFile, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
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

const msBtn = (variant: 'primary' | 'ghost' | 'disabled'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  border: variant === 'primary' ? 'none' : '1px solid var(--ms-neutral-30)',
  borderRadius: 4, cursor: variant === 'disabled' ? 'not-allowed' : 'pointer',
  fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
  background: variant === 'primary' ? 'var(--ms-blue)' : '#fff',
  color: variant === 'primary' ? '#fff' : variant === 'disabled' ? 'var(--ms-neutral-40)' : 'var(--ms-neutral-110)',
  opacity: variant === 'disabled' ? 0.6 : 1,
});

export default function FileAccessHistory() {
  const [accessHistory, setAccessHistory] = useState<FileAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 20, totalPages: 0 });

  const fetchAccessHistory = async () => {
    try {
      setLoading(true); setError(null);
      const response = await fetch(`/api/file-access-history?page=${pagination.page}&limit=${pagination.limit}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch access history');
      }
      const data = await response.json();
      setAccessHistory(data.accessHistory || []);
      setPagination({ total: data.total || 0, page: data.page || 1, limit: data.limit || 20, totalPages: data.totalPages || 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      toast.error(`Failed to fetch access history: ${msg}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAccessHistory(); }, [pagination.page, pagination.limit]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) setPagination(p => ({ ...p, page: newPage }));
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--ms-neutral-30)', borderTopColor: 'var(--ms-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ms-red)' }}>
      <p>{error}</p>
      <button style={msBtn('ghost')} onClick={fetchAccessHistory}>Retry</button>
    </div>
  );

  if (accessHistory.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <FiClock style={{ width: 40, height: 40, color: 'var(--ms-neutral-40)', marginBottom: 12 }} />
      <p style={{ color: 'var(--ms-neutral-60)', fontSize: 14 }}>No access history found</p>
    </div>
  );

  const columns = ['2fr', '1.5fr', '1.5fr'];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ms-neutral-60)' }}>
          Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
        </p>
        <select
          value={pagination.limit}
          onChange={e => setPagination(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
          style={{ padding: '5px 10px', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, fontSize: 13, color: 'var(--ms-neutral-110)', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--ms-neutral-20)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: columns.join(' '), padding: '10px 16px', background: 'var(--ms-neutral-10)', borderBottom: '1px solid var(--ms-neutral-20)', fontSize: 11, fontWeight: 700, color: 'var(--ms-neutral-90)', textTransform: 'uppercase', letterSpacing: '0.05em', gap: 8 }}>
          <span>File Path</span><span>User</span><span>Timestamp</span>
        </div>
        {accessHistory.map((access, i) => (
          <div key={access.id}
            style={{ display: 'grid', gridTemplateColumns: columns.join(' '), padding: '11px 16px', borderBottom: i < accessHistory.length - 1 ? '1px solid var(--ms-neutral-10)' : 'none', gap: 8, fontSize: 13, alignItems: 'center', transition: 'background var(--transition-fast)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-neutral-10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <FiFile style={{ flexShrink: 0, color: 'var(--ms-neutral-60)', width: 14, height: 14 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ms-neutral-160)' }}>{access.filePath}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiUser style={{ flexShrink: 0, color: 'var(--ms-neutral-60)', width: 14, height: 14 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{access.username || access.userEmail || 'Unknown'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ms-neutral-60)', fontSize: 12 }}>
              <FiClock style={{ flexShrink: 0, width: 13, height: 13 }} />
              {new Date(access.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--ms-neutral-60)' }}>Page {pagination.page} of {pagination.totalPages}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={msBtn(pagination.page === 1 ? 'disabled' : 'ghost')} onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1}>
            <FiChevronLeft size={14} /> Previous
          </button>
          <button style={msBtn(pagination.page === pagination.totalPages ? 'disabled' : 'ghost')} onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === pagination.totalPages}>
            Next <FiChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}