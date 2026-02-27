// ---------------------------------------------------------------------------
// OpenWebClaw — Layout shell (OpenWebUI Design)
// ---------------------------------------------------------------------------

import { Outlet, NavLink, useLocation } from 'react-router';
import { MessageSquare, FolderOpen, Clock, Settings, Menu, Plus, PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.js';
import { FileViewerModal } from '../files/FileViewerModal.js';
import { useFileViewerStore } from '../../stores/file-viewer-store.js';
import { useAuthStore } from '../../stores/auth-store.js';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/files', label: 'Workspace', icon: FolderOpen },
  { to: '/tasks', label: 'Tasks', icon: Clock },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Layout() {
  const viewerFile = useFileViewerStore((s) => s.file);
  const closeFile = useFileViewerStore((s) => s.closeFile);
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen h-[100dvh] bg-base-100 text-base-content overflow-hidden font-sans">
      {/* ---- Desktop Sidebar ---- */}
      <aside
        className={`hidden md:flex flex-col bg-base-200/50 border-r border-base-300 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-[260px]' : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="p-3 flex items-center justify-between">
          <NavLink to="/chat" className="flex items-center gap-2 px-2 py-1.5 hover:bg-base-300/50 rounded-lg transition-colors w-full">
            <div className="w-7 h-7 rounded-full bg-base-content text-base-100 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm truncate">New Chat</span>
            <Plus className="w-4 h-4 ml-auto opacity-50" />
          </NavLink>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-xs font-medium text-base-content/50 px-2 py-2">Menu</div>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-base-300 text-base-content font-medium'
                    : 'text-base-content/70 hover:bg-base-300/50 hover:text-base-content'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="p-3 border-t border-base-300 mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-base-content font-bold text-xs">
              U
            </div>
            <span className="text-sm font-medium text-base-content/80">User</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-base-300/50 text-base-content/50 hover:text-error transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---- Mobile Sidebar Overlay ---- */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ---- Mobile Sidebar ---- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-base-200 border-r border-base-300 transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3 flex items-center justify-between">
          <NavLink to="/chat" className="flex items-center gap-2 px-2 py-1.5 hover:bg-base-300/50 rounded-lg transition-colors w-full">
            <div className="w-7 h-7 rounded-full bg-base-content text-base-100 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm truncate">New Chat</span>
            <Plus className="w-4 h-4 ml-auto opacity-50" />
          </NavLink>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-xs font-medium text-base-content/50 px-2 py-2">Menu</div>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-base-300 text-base-content font-medium'
                    : 'text-base-content/70 hover:bg-base-300/50 hover:text-base-content'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="p-3 border-t border-base-300 mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-base-content font-bold text-xs">
              U
            </div>
            <span className="text-sm font-medium text-base-content/80">User</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-base-300/50 text-base-content/50 hover:text-error transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---- Main Content ---- */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-base-100">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-3 border-b border-base-300/50 md:border-none shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex p-2 hover:bg-base-200 rounded-lg text-base-content/70 transition-colors"
              aria-label="Toggle Sidebar"
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 hover:bg-base-200 rounded-lg text-base-content/70 transition-colors"
              aria-label="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Model Selector / Title Area */}
            <div className="font-medium text-lg px-2 flex items-center gap-2 cursor-pointer hover:bg-base-200 rounded-lg py-1 transition-colors">
              OpenWebClaw
              <span className="text-xs text-base-content/50 font-normal bg-base-200 px-1.5 py-0.5 rounded">v0.1</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Optional top right actions */}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </main>

      {/* ---- Global file viewer modal ---- */}
      {viewerFile && (
        <FileViewerModal
          name={viewerFile.name}
          content={viewerFile.content}
          onClose={closeFile}
        />
      )}
    </div>
  );
}
