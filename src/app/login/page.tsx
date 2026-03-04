'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiHardDrive, FiLock, FiMail } from 'react-icons/fi';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await login(email, password);
      toast.success('Signed in successfully');
      window.location.href = '/';
    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ms-background)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-primary)',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            background: 'var(--ms-blue)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            boxShadow: '0 4px 12px rgba(0,120,212,0.3)',
          }}>
            <FiHardDrive style={{ width: 26, height: 26, color: '#fff' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ms-neutral-160)' }}>KFC File Manager</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--ms-neutral-60)', fontSize: 13 }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: 6,
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--ms-neutral-20)',
          overflow: 'hidden',
        }}>
          {/* Blue accent stripe */}
          <div style={{ height: 4, background: 'var(--ms-blue)' }} />

          <form onSubmit={handleSubmit} style={{ padding: '28px 28px 24px' }}>
            {/* Email field */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ms-neutral-110)', marginBottom: 6 }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <FiMail style={{
                  position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--ms-neutral-60)', width: 16, height: 16,
                }} />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  style={{
                    width: '100%',
                    paddingLeft: 36,
                    paddingRight: 12,
                    paddingTop: 9,
                    paddingBottom: 9,
                    border: '1px solid var(--ms-neutral-30)',
                    borderRadius: 4,
                    fontSize: 13,
                    color: 'var(--ms-neutral-160)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ms-neutral-110)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <FiLock style={{
                  position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--ms-neutral-60)', width: 16, height: 16,
                }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    paddingLeft: 36,
                    paddingRight: 40,
                    paddingTop: 9,
                    paddingBottom: 9,
                    border: '1px solid var(--ms-neutral-30)',
                    borderRadius: 4,
                    fontSize: 13,
                    color: 'var(--ms-neutral-160)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--ms-blue)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--ms-neutral-30)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ms-neutral-60)', padding: 2,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: loading ? 'var(--ms-neutral-40)' : 'var(--ms-blue)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--ms-blue-dark)'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--ms-blue)'; }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}