'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Navigation from './Navigation';

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="app-shell">
        {/* Sidebar slot */}
        <div
          className="app-sidebar"
          style={{
            width: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
            minWidth: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            zIndex: 40,
          }}
        >
          <Navigation />
        </div>

        {/* Main content — shifts with sidebar */}
        <main
          className="app-main"
          style={{
            marginLeft: isCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-expanded)',
            minHeight: '100vh',
            background: 'var(--ms-background)',
          }}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
