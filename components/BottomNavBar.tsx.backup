import React from 'react';
import type { Page, Language } from '../types';
import { translations } from '../constants';
import { HomeIcon, SearchIcon, PlusIcon, UserIcon } from './icons';

interface BottomNavBarProps {
  activePage: Page;
  onNavigate: (page: Page | 'create') => void;
  language: Language;
}

const NavItem: React.FC<{
    page: Page | 'create';
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: (page: Page | 'create') => void;
}> = ({ page, label, icon, isActive, onClick }) => {
    const activeClasses = isActive ? 'text-indigo-500' : 'text-gray-500 dark:text-zinc-400';
    return (
        <button
            onClick={() => onClick(page)}
            className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors duration-200 hover:text-indigo-500 dark:hover:text-indigo-400 ${activeClasses}`}
            aria-current={isActive ? 'page' : undefined}
        >
            {icon}
            <span className="text-xs font-medium">{label}</span>
        </button>
    );
};

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activePage, onNavigate, language }) => {
  const t = translations[language];

  const navItems = [
    { page: 'home' as Page, label: t.navHome, icon: <HomeIcon className="w-6 h-6" /> },
    { page: 'explore' as Page, label: t.navExplore, icon: <SearchIcon className="w-6 h-6" /> },
    { page: 'create' as const, label: t.navCreate, icon: <PlusIcon className="w-7 h-7" /> },
    { page: 'profile' as Page, label: t.navProfile, icon: <UserIcon className="w-6 h-6" /> },
  ];
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 px-4 bottom-nav-wrapper">
        <nav className="max-w-lg mx-auto bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg rounded-2xl flex justify-around items-center h-16 border border-gray-300/80 dark:border-zinc-700/80 shadow-lg">
            {navItems.map(item => (
                <NavItem
                    key={item.page}
                    page={item.page}
                    label={item.label}
                    icon={item.icon}
                    isActive={activePage === item.page || (item.page === 'create' && false)}
                    onClick={onNavigate}
                />
            ))}
        </nav>
    </div>
  );
};

export default BottomNavBar;