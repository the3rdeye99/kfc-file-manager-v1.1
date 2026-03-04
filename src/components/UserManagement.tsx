'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiTrash2, FiArrowLeft, FiEdit2, FiX, FiLock, FiEye, FiEyeOff, FiUser, FiClock, FiUsers, FiShield } from 'react-icons/fi';
import { deleteUser, updateUser, updateUserRole } from '@/app/actions/userActions';
import FileAccessHistory from './FileAccessHistory';

interface User {
  uid: string;
  email: string;
  role: 'admin' | 'viewer' | 'editor';
  displayName: string;
}

const msBtn = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  border: variant === 'ghost' ? '1px solid var(--ms-neutral-30)' : 'none',
  borderRadius: 4, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
  background: variant === 'primary' ? 'var(--ms-blue)' : variant === 'danger' ? 'var(--ms-red)' : '#fff',
  color: variant === 'ghost' ? 'var(--ms-neutral-110)' : '#fff',
  transition: 'background var(--transition-fast)',
});

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid var(--ms-neutral-30)',
  borderRadius: 4, fontSize: 13, color: 'var(--ms-neutral-160)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<User | null>(null);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'history'>('users');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally { setLoading(false); }
  };

  if (!user?.email?.includes('admin')) { router.push('/'); return null; }

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find(u => u.uid === userId);
    if (userToDelete?.role === 'admin') { toast.error('Cannot delete admin users'); return; }
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    try {
      const result = await deleteUser(userId);
      if (result.success) { setUsers(users.filter(u => u.uid !== userId)); toast.success('User deleted'); }
      else toast.error(result.error || 'Failed to delete user');
    } catch { toast.error('Failed to delete user'); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !newName.trim()) { toast.error('Please enter a valid name'); return; }
    try {
      const result = await updateUser(editingUser.uid, newName);
      if (result.success) {
        setUsers(users.map(u => u.uid === editingUser.uid ? { ...u, displayName: newName } : u));
        setEditingUser(null); toast.success('User updated');
      } else toast.error(result.error || 'Failed to update user');
    } catch { toast.error('Failed to update user'); }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword.trim()) { toast.error('Please enter a valid password'); return; }
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: selectedUser.uid, newPassword }),
      });
      if (!response.ok) throw new Error('Failed to change password');
      toast.success('Password changed successfully');
      setShowPasswordModal(false); setNewPassword(''); setSelectedUser(null);
    } catch { toast.error('Failed to change password'); }
  };

  const handleChangeRole = async (u: User, newRole: 'viewer' | 'editor') => {
    try {
      await updateUserRole(u.uid, newRole);
      toast.success(`Role updated to ${newRole}`);
      setEditingRole(null); loadUsers();
    } catch { toast.error('Failed to update role'); }
  };

  const getRoleBadge = (email: string, role: string) => {
    const isAdm = email === 'admin@kayodefilani.com';
    const label = isAdm ? 'Admin' : role === 'editor' ? 'Editor' : 'Viewer';
    const colors: Record<string, string> = { Admin: '#4f2dc8', Editor: 'var(--ms-orange)', Viewer: 'var(--ms-green)' };
    const bgs: Record<string, string> = { Admin: '#ede6fd', Editor: '#fdf2ea', Viewer: '#e6f4e6' };
    return (
      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: bgs[label], color: colors[label] }}>
        {label}
      </span>
    );
  };

  const initials = (u: User) => (u.displayName || u.email || 'U').slice(0, 2).toUpperCase();

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--ms-neutral-30)', borderTopColor: 'var(--ms-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 6, boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 440, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--ms-neutral-20)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ms-neutral-160)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', padding: 4, display: 'flex', borderRadius: 4 }}>
            <FiX size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-90)', fontSize: 13, fontFamily: 'inherit', marginBottom: 16 }}>
          <FiArrowLeft size={15} /> Back
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ms-neutral-160)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiUsers style={{ color: 'var(--ms-neutral-60)' }} /> User Management
        </h1>
      </div>

      {/* Pivot tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ms-neutral-20)', marginBottom: 20, gap: 0 }}>
        {([['users', FiUser, 'Users'], ['history', FiClock, 'Access History']] as [string, any, string][]).map(([tab, Icon, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--ms-blue)' : 'var(--ms-neutral-90)',
              borderBottom: activeTab === tab ? '2px solid var(--ms-blue)' : '2px solid transparent',
              marginBottom: -1, transition: 'color var(--transition-fast)',
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? (
        <div style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--ms-neutral-20)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {users.map((u, i) => (
            <div key={u.uid}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < users.length - 1 ? '1px solid var(--ms-neutral-10)' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-neutral-10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ms-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0, letterSpacing: 0.5 }}>
                  {initials(u)}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-160)' }}>{u.displayName || 'No name set'}</p>
                  <p style={{ margin: '2px 0 4px', fontSize: 12, color: 'var(--ms-neutral-60)' }}>{u.email}</p>
                  {getRoleBadge(u.email, u.role)}
                </div>
              </div>
              {u.email !== 'admin@kayodefilani.com' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => { setEditingUser(u); setNewName(u.displayName || ''); }} style={{ ...msBtn('ghost'), fontSize: 12 }}>
                    <FiEdit2 size={13} /> Edit
                  </button>
                  {u.role !== 'admin' && (
                    <>
                      <button onClick={() => { setSelectedUser(u); setShowPasswordModal(true); }} style={{ ...msBtn('ghost'), fontSize: 12 }}>
                        <FiLock size={13} /> Password
                      </button>
                      <button onClick={() => setEditingRole(u)} style={{ ...msBtn('ghost'), fontSize: 12 }}>
                        <FiShield size={13} /> Role
                      </button>
                      <button onClick={() => handleDeleteUser(u.uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-red)', padding: '6px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <FiTrash2 size={13} /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <FileAccessHistory />
      )}

      {/* Edit Name Modal */}
      {editingUser && (
        <Modal title="Edit User" onClose={() => setEditingUser(null)}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 4 }}>Email</label>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ms-neutral-60)' }}>{editingUser.email}</p>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 6 }}>Display name</label>
            <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name"
              onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
              onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={msBtn('ghost')} onClick={() => setEditingUser(null)}>Cancel</button>
            <button style={msBtn('primary')} onClick={handleUpdateUser}>Save changes</button>
          </div>
        </Modal>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <Modal title="Change Password" onClose={() => { setShowPasswordModal(false); setNewPassword(''); setSelectedUser(null); }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 4 }}>User</label>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ms-neutral-60)' }}>{selectedUser?.email}</p>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 6 }}>New password</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: 36 }} type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters"
                onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', display: 'flex', alignItems: 'center' }}>
                {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              </button>
            </div>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--ms-neutral-60)' }}>Password must be at least 6 characters.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button style={msBtn('ghost')} onClick={() => { setShowPasswordModal(false); setNewPassword(''); setSelectedUser(null); }}>Cancel</button>
            <button style={msBtn('primary')} onClick={handleChangePassword}>Update password</button>
          </div>
        </Modal>
      )}

      {/* Role Modal */}
      {editingRole && (
        <Modal title="Change Role" onClose={() => setEditingRole(null)}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ms-neutral-90)', marginBottom: 4 }}>User</label>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ms-neutral-60)' }}>{editingRole.email}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {([['viewer', 'Viewer', 'Can view files only'], ['editor', 'Editor', 'Can view and download files']] as [string, string, string][]).map(([val, label, desc]) => (
              <div key={val} onClick={() => handleChangeRole(editingRole, val as any)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${editingRole.role === val ? 'var(--ms-blue)' : 'var(--ms-neutral-30)'}`, borderRadius: 4, cursor: 'pointer', background: editingRole.role === val ? 'var(--ms-blue-light)' : '#fff', transition: 'border-color var(--transition-fast)' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${editingRole.role === val ? 'var(--ms-blue)' : 'var(--ms-neutral-40)'}`, background: editingRole.role === val ? 'var(--ms-blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {editingRole.role === val && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ms-neutral-60)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={msBtn('ghost')} onClick={() => setEditingRole(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}