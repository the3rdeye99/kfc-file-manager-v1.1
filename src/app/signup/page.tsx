'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signup } from '@/app/actions/userActions';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiEye, FiEyeOff, FiMail, FiUser, FiLock, FiShield } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user && !user.email?.includes('admin')) router.push('/');
  }, [user, router]);

  if (!user || !user.email?.includes('admin')) return null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--ms-neutral-30)',
    borderRadius: 4,
    fontSize: 13,
    color: 'var(--ms-neutral-160)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color var(--transition-fast)',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(email, password, username, role);
      toast.success('User account created successfully');
      router.push('/users');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const RoleCard = ({ value, title, description }: { value: 'viewer' | 'editor'; title: string; description: string }) => (
    <div
      onClick={() => setRole(value)}
      style={{
        padding: '12px 14px',
        border: `2px solid ${role === value ? 'var(--ms-blue)' : 'var(--ms-neutral-30)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        background: role === value ? 'var(--ms-blue-light)' : '#fff',
        transition: 'border-color var(--transition-fast), background var(--transition-fast)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        border: `2px solid ${role === value ? 'var(--ms-blue)' : 'var(--ms-neutral-40)'}`,
        background: role === value ? 'var(--ms-blue)' : 'transparent',
        flexShrink: 0,
        marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {role === value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-160)' }}>{title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ms-neutral-90)' }}>{description}</p>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 20px' }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ms-neutral-90)', fontSize: 13, fontFamily: 'inherit',
            marginBottom: 20, padding: '6px 0',
          }}
        >
          <FiArrowLeft size={16} /> Back
        </button>

        <div style={{
          background: '#fff',
          borderRadius: 6,
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--ms-neutral-20)',
          overflow: 'hidden',
        }}>
          <div style={{ height: 4, background: 'var(--ms-blue)' }} />
          <div style={{ padding: '24px 28px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--ms-neutral-160)' }}>
              Create New User Account
            </h2>
            <p style={{ margin: '0 0 24px', color: 'var(--ms-neutral-60)', fontSize: 13 }}>
              Add a new user with their email, display name, and role.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-110)', marginBottom: 6 }}>Email address</label>
                <div style={{ position: 'relative' }}>
                  <FiMail style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ms-neutral-60)', width: 15, height: 15 }} />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com"
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')} />
                </div>
              </div>

              {/* Username */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-110)', marginBottom: 6 }}>Display name</label>
                <div style={{ position: 'relative' }}>
                  <FiUser style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ms-neutral-60)', width: 15, height: 15 }} />
                  <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Full Name"
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-110)', marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <FiLock style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ms-neutral-60)', width: 15, height: 15 }} />
                  <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"
                    style={{ ...inputStyle, paddingLeft: 34, paddingRight: 38 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ms-neutral-60)', padding: 2, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--ms-neutral-110)', marginBottom: 8 }}>
                  <FiShield size={14} /> User Role
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <RoleCard value="viewer" title="Viewer" description="Can view files only — no download access" />
                  <RoleCard value="editor" title="Editor" description="Can view and download files" />
                </div>
              </div>

              {/* Submit */}
              <div style={{ paddingTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => router.back()}
                  style={{ padding: '9px 18px', background: '#fff', border: '1px solid var(--ms-neutral-30)', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ms-neutral-110)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  style={{
                    padding: '9px 20px', background: loading ? 'var(--ms-neutral-40)' : 'var(--ms-blue)',
                    border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontFamily: 'inherit', color: '#fff', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  {loading ? 'Creating…' : 'Create user'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}