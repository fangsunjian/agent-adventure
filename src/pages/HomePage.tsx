import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStories } from '../hooks/useStories';
import { useAppStore } from '../stores/appStore';
import { useAuth } from '../../contexts/AuthContext';
import type { Story } from '../../types';
import StoryCard from '../../components/StoryCard';
import LoadingOverlay from '../../components/LoadingOverlay';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { setActiveStory } = useAppStore();
    const { user } = useAuth();

    // Fetch stories - show public stories for all users, or user's own stories when logged in
    const { data: stories, isLoading, error } = useStories();

    const handlePlayStory = (story: Story) => {
        console.log('Handling play story:', story.id, story.title);
        setActiveStory(story.id);
        console.log('Navigating to:', `/game/${story.id}`);
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

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                {(stories || []).map(story => (
                    <button key={story.id} onClick={() => handlePlayStory(story)} className="text-left">
                        <StoryCard story={story} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default HomePage;