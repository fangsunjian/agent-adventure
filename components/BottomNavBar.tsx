import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Language } from '../types';
import { translations } from '../constants';
import { HomeIcon, SearchIcon, PlusIcon, UserIcon } from './icons';
import { useAppStore } from '../src/stores/appStore';

interface BottomNavBarProps {
  language: Language;
}

interface NavItemProps {
  to?: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, label, icon, isActive, onClick }) => {
  const baseClasses = "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-0 flex-1";

  const stateClasses = isActive
    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700/50 hover:text-indigo-600 dark:hover:text-indigo-400";

  const className = `${baseClasses} ${stateClasses}`;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={className}
        aria-current={isActive ? 'page' : undefined}
      >
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </button>
    );
  }

  return (
    <Link
      to={to!}
      className={className}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
};

const BottomNavBar: React.FC<BottomNavBarProps> = ({ language }) => {
  const location = useLocation();
  const { setModal, modals } = useAppStore();
  const t = translations[language];

  const handleCreateClick = () => {
    console.log('🔥 Create button clicked!');
    console.log('🔥 Current modals state:', modals);
    setModal('newGame', true);
    console.log('🔥 Called setModal with newGame=true');
  };

  // Determine active page from current location
  const getActivePage = (pathname: string) => {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/explore')) return 'explore';
    if (pathname.startsWith('/profile')) return 'profile';
    return '';
  };

  const activePage = getActivePage(location.pathname);

  const navItems = [
    { key: 'home', to: '/', label: t.navHome, icon: <HomeIcon className="w-6 h-6" />, isActive: activePage === 'home' },
    { key: 'explore', to: '/explore', label: t.navExplore, icon: <SearchIcon className="w-6 h-6" />, isActive: activePage === 'explore' },
    { key: 'create', onClick: handleCreateClick, label: t.navCreate, icon: <PlusIcon className="w-7 h-7" />, isActive: false },
    { key: 'profile', to: '/profile', label: t.navProfile, icon: <UserIcon className="w-6 h-6" />, isActive: activePage === 'profile' },
  ];

  return (
    <div className="fixed left-0 right-0 z-50 px-4" style={{ bottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}>
      <nav className="max-w-lg mx-auto bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg rounded-2xl flex justify-around items-center h-16 border border-gray-300/80 dark:border-zinc-700/80 shadow-lg">
        {navItems.map(item => (
          <NavItem
            key={item.key}
            to={item.to}
            label={item.label}
            icon={item.icon}
            isActive={item.isActive}
            onClick={item.onClick}
          />
        ))}
      </nav>
    </div>
  );
};

export default BottomNavBar;