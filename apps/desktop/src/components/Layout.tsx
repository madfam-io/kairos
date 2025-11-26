import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Play,
  Library,
  BookOpen,
  Settings,
  Minimize2,
  Maximize2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { window as tauriWindow } from '@tauri-apps/api';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/player', icon: Play, label: 'Player' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/vocabulary', icon: BookOpen, label: 'Vocabulary' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const location = useLocation();
  const isPlayerPage = location.pathname === '/player';

  // Hide sidebar in fullscreen player mode
  if (isPlayerPage) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center justify-center border-b border-gray-800 drag-region">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kairos-500 to-kairos-700 flex items-center justify-center no-drag">
            <span className="text-lg font-bold">开</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-2 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center justify-center w-12 h-12 rounded-xl transition-colors',
                      isActive
                        ? 'bg-kairos-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )
                  }
                  title={item.label}
                >
                  <item.icon size={22} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Stats at bottom */}
        <div className="p-2 border-t border-gray-800">
          <div className="bg-gray-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-semibold text-kairos-400">0</p>
            <p className="text-xs text-gray-500">streak</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Title bar */}
        <TitleBar />

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = async () => {
    const appWindow = await tauriWindow.getCurrent();
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = await tauriWindow.getCurrent();
    const maximized = await appWindow.isMaximized();
    if (maximized) {
      await appWindow.unmaximize();
      setIsMaximized(false);
    } else {
      await appWindow.maximize();
      setIsMaximized(true);
    }
  };

  const handleClose = async () => {
    const appWindow = await tauriWindow.getCurrent();
    await appWindow.close();
  };

  return (
    <header className="h-10 bg-gray-900 border-b border-gray-800 flex items-center justify-end px-2 drag-region">
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-gray-800 rounded transition-colors"
        >
          <Minimize2 size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="p-2 hover:bg-gray-800 rounded transition-colors"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-red-600 rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
