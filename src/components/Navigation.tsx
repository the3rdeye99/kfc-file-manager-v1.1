'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiUsers, FiLogOut, FiTrash2, FiUser, FiHome, FiChevronLeft, FiChevronRight, FiHardDrive, FiUserPlus } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { useSidebar } from './AppShell';

export default function SideNavigation() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    // Keep backward compatibility with FileManager event listener
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed: newState } }));
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out');
    }
  };

  const username = user?.email?.split('@')[0] || 'User';
  const isAdmin = user?.email?.includes('admin');
  const initials = username.slice(0, 2).toUpperCase();

  const menuItems = [
    { href: '/', icon: FiHome, label: 'Files' },
    { href: '/trash', icon: FiTrash2, label: 'Recycle Bin', adminOnly: true },
    { href: '/signup', icon: FiUserPlus, label: 'Add User', adminOnly: true },
    { href: '/users', icon: FiUsers, label: 'Manage Users', adminOnly: true },
  ].filter(item => !item.adminOnly || isAdmin);

  const isActive = (path: string) => pathname === path;

  return (
    <aside
      style={{
        width: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
        height: '100vh',
        background: '#ffffff',
        borderRight: '1px solid var(--ms-neutral-30)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width var(--transition-normal)',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
      }}
    >
      {/* ── App Header ── */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: isCollapsed ? '0 8px' : '0 12px',
          gap: 10,
          borderBottom: '1px solid var(--ms-neutral-20)',
          flexShrink: 0,
          background: 'var(--ms-blue)',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FiHardDrive style={{ color: '#fff', width: 16, height: 16 }} />
        </div>
        {!isCollapsed && (
          <span
            style={{
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            KFC File Manager
          </span>
        )}
      </div>


      {/* ── User Avatar ── */}
      <div
        style={{
          padding: isCollapsed ? '12px 8px' : '12px 14px',
          borderBottom: '1px solid var(--ms-neutral-20)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--ms-blue)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 12,
            flexShrink: 0,
            letterSpacing: 0.5,
          }}
        >
          {initials}
        </div>
        {!isCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontWeight: 600, fontSize: 13, margin: 0, color: 'var(--ms-neutral-160)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {username}
            </p>
            <p style={{ fontSize: 11, margin: 0, color: 'var(--ms-neutral-60)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation Menu ── */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: isCollapsed ? '10px 0' : '10px 14px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                color: active ? 'var(--ms-blue)' : 'var(--ms-neutral-110)',
                background: active ? 'var(--ms-blue-light)' : 'transparent',
                borderLeft: active ? '3px solid var(--ms-blue)' : '3px solid transparent',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                transition: 'background var(--transition-fast), color var(--transition-fast)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--ms-neutral-10)';
                  e.currentTarget.style.color = 'var(--ms-neutral-160)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--ms-neutral-110)';
                }
              }}
            >
              <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* ── Logout ── */}
      <div style={{ borderTop: '1px solid var(--ms-neutral-20)', padding: '8px 0', flexShrink: 0, position: 'relative' }}>
        {/* Collapse Toggle — Repositioned inside */}
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute',
            top: -14,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1px solid var(--ms-neutral-30)',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            color: 'var(--ms-neutral-90)',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-neutral-10)')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          {isCollapsed
            ? <FiChevronRight style={{ width: 14, height: 14 }} />
            : <FiChevronLeft style={{ width: 14, height: 14 }} />
          }
        </button>

        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Sign out' : ''}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: isCollapsed ? '10px 0' : '10px 14px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ms-red)',
            fontSize: 13,
            fontFamily: 'inherit',
            transition: 'background var(--transition-fast)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fdf3f3')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <FiLogOut style={{ width: 18, height: 18, flexShrink: 0 }} />
          {!isCollapsed && <span style={{ fontWeight: 500 }}>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}