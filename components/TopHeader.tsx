import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Page, Language } from '../types';
import { translations } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon } from './icons';

interface TopHeaderProps {
    activePage: Page;
    language: Language;
}

const TopHeader: React.FC<TopHeaderProps> = ({ activePage, language }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const t = translations[language];

    const titles = {
        home: 'Featured Stories',
        explore: 'Explore Stories',
        profile: 'Profile',
        game: '', // Game has its own header
    };
    const title = titles[activePage] || '';

    const handleLoginClick = () => {
        navigate('/auth');
    };

    const handleProfileClick = () => {
        navigate('/profile');
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-10 bg-white/80 dark:bg-zinc-950/70 backdrop-blur-sm border-b border-gray-200/80 dark:border-zinc-800/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="h-16 flex items-center justify-between px-4 md:px-6">
                <h1 className="text-3xl font-bold font-serif text-gray-800 dark:text-zinc-200">{title}</h1>

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
                            登录
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopHeader;
