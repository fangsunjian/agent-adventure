import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Story } from '../../types';
import { translations } from '../../constants';
import StoryCard from '../../components/StoryCard';
import { SearchIcon } from '../../components/icons';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useStories } from '../hooks/useStories';
import { useAppStore } from '../stores/appStore';
import LoadingOverlay from '../../components/LoadingOverlay';

const ExplorePage: React.FC = () => {
    const navigate = useNavigate();
    const { setActiveStory } = useAppStore();
    const { settings } = useUserSettings();
    const { data: stories, isLoading, error } = useStories();

    const t = translations[settings?.language || 'zh'];
    const categories = ['Fantasy', 'Sci-Fi', 'Mystery', 'Horror', 'Adventure'];

    const handlePlayStory = (story: Story) => {
        setActiveStory(story.id);
        navigate(`/game/${story.id}`);
    };

    if (isLoading) {
        return <LoadingOverlay messages={['Loading Stories...']} />;
    }

    if (error) {
        return (
            <div className="p-4 text-center">
                <p className="text-red-500">Failed to load stories. Please try again.</p>
            </div>
        );
    }

    const publicStories = stories?.filter(s => s.visibility === 'public') || [];

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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                 {publicStories.map(story => (
                    <button key={story.id} onClick={() => handlePlayStory(story)} className="text-left">
                        <StoryCard story={story} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ExplorePage;