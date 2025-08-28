import React from 'react';
import type { GameSettings, Story } from '../types';
import StoryCard from '../components/StoryCard';

interface HomePageProps {
    settings: GameSettings;
    stories: Story[];
    onPlay: (story: Story) => void;
}

const HomePage: React.FC<HomePageProps> = ({ settings, stories, onPlay }) => {
    const publicStories = stories.filter(s => s.visibility === 'public');
    
    return (
        <div className="p-4 md:p-6 lg:p-8">
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

export default HomePage;