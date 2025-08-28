import React from 'react';
import type { GameSettings, Story } from '../types';
import { translations } from '../constants';
import StoryCard from '../components/StoryCard';
import { SearchIcon } from '../components/icons';

interface ExplorePageProps {
    settings: GameSettings;
    stories: Story[];
    onPlay: (story: Story) => void;
}

const ExplorePage: React.FC<ExplorePageProps> = ({ settings, stories, onPlay }) => {
    const t = translations[settings.language];
    const categories = ['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Adventure'];
    const publicStories = stories.filter(s => s.visibility === 'public');
    
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder={t.exploreSearchPlaceholder}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-zinc-500" />
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
                {categories.map(cat => (
                    <button key={cat} className="px-3 py-1 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-full hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 transition-colors">
                        {cat}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {publicStories.map(story => (
                    <button key={story.id} onClick={() => onPlay(story)} className="text-left">
                        <StoryCard story={story} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ExplorePage;