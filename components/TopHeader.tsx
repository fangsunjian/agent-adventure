import React from 'react';
import type { Page, Language } from '../types';
import { translations } from '../constants';

interface TopHeaderProps {
    activePage: Page;
    language: Language;
}

const TopHeader: React.FC<TopHeaderProps> = ({ activePage, language }) => {
    const t = translations[language];
    const titles = {
        home: 'Featured Stories',
        explore: 'Explore Stories',
        profile: 'Profile',
        game: '', // Game has its own header
    };
    const title = titles[activePage] || '';

    return (
        <header className="fixed top-0 left-0 right-0 z-10 bg-white/80 dark:bg-zinc-950/70 backdrop-blur-sm border-b border-gray-200/80 dark:border-zinc-800/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="h-16 flex items-center px-4 md:px-6">
                <h1 className="text-3xl font-bold font-serif text-gray-800 dark:text-zinc-200">{title}</h1>
            </div>
        </header>
    );
};

export default TopHeader;
