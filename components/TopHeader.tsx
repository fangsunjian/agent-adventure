import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Page, Language } from '../types';
import { translations } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, HomeIcon, SearchIcon, PlusIcon } from './icons';
import { useAppStore } from '../src/stores/appStore';

interface TopHeaderProps {
    activePage: Page;
    language: Language;
}

const TopHeader: React.FC<TopHeaderProps> = ({ activePage, language }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { setModal } = useAppStore();
    const t = translations[language];

    const handleLoginClick = () => {
        navigate('/auth');
    };

    const handleProfileClick = () => {
        navigate('/profile');
    };

    const handleCreateClick = () => {
        setModal('newGame', true);
    };

    // Check if current path is active
    const isActive = (path: string) => {
        if (path === '/' && location.pathname === '/') return true;
        if (path !== '/' && location.pathname.startsWith(path)) return true;

        return false;
    };

    // Mobile view - keep original design for small screens
    const renderMobileHeader = () => (
        <div className="h-16 flex items-center justify-between px-4 md:px-6 bg-white/80 dark:bg-zinc-950/70 backdrop-blur-sm border-b border-gray-200/80 dark:border-zinc-800/80">
            <h1 className="text-3xl font-bold font-serif text-gray-800 dark:text-zinc-200">
                {activePage === 'home' && t.titleFeatured}
                {activePage === 'explore' && t.titleExplore}
                {activePage === 'profile' && t.titleProfile}
            </h1>

            <div className="flex items-center gap-3">
                {user ? (
                    <button
                        onClick={handleProfileClick}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        <UserIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
                    </button>
                ) : (
                    <button
                        onClick={handleLoginClick}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {t.navLogin}
                    </button>
                )}
            </div>
        </div>
    );

    // Desktop view - new horizontal navigation
    const renderDesktopHeader = () => (
        <div className="h-16 flex items-center justify-between px-6 text-gray-700 dark:text-zinc-200">
            {/* Left section: Logo + Navigation */}
            <div className="flex items-center gap-8">
                {/* Logo */}
                <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    Logo
                </div>

                {/* Navigation items */}
                <nav className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                            isActive('/')
                                ? 'bg-indigo-500 text-white shadow-sm'
                                : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                        }`}
                    >
                        <HomeIcon className="w-5 h-5" />
                        <span className="text-sm font-medium">{t.navHome}</span>
                    </button>
                    <button
                        onClick={() => navigate('/explore')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                            isActive('/explore')
                                ? 'bg-indigo-500 text-white shadow-sm'
                                : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                        }`}
                    >
                        <SearchIcon className="w-5 h-5" />
                        <span className="text-sm font-medium">{t.navExplore}</span>
                    </button>
                </nav>
            </div>

            {/* Center section: Search */}
            <div className="flex-1 max-w-xl mx-8">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                        type="text"
                        placeholder={t.exploreSearchPlaceholder}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Right section: User + Actions */}
            <div className="flex items-center gap-4">
                {/* User info/login */}
                {user ? (
                    <button
                        onClick={handleProfileClick}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-white rounded-lg transition-colors text-sm"
                    >
                        <UserIcon className="w-4 h-4" />
                        <span>{t.navProfile}</span>
                    </button>
                ) : (
                    <button
                        onClick={handleLoginClick}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-white rounded-lg transition-colors text-sm"
                    >
                        <UserIcon className="w-4 h-4" />
                        <span>{t.navLogin}</span>
                    </button>
                )}

                {/* Action buttons */}
                <button
                    onClick={user ? () => navigate('/profile') : handleLoginClick}
                    className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
                >
                    {t.navHistory}
                </button>
                <button
                    onClick={user ? handleCreateClick : handleLoginClick}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    {t.navCreate}
                </button>
            </div>
        </div>
    );

    return (
        <header className="fixed top-0 left-0 right-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Show mobile header on small screens, desktop header on large screens - updated */}
            <div className="block lg:hidden">
                {renderMobileHeader()}
            </div>
            <div className="hidden lg:block bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 backdrop-blur">
                {renderDesktopHeader()}
            </div>
        </header>
    );
};

export default TopHeader;
