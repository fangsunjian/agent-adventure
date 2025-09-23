import React, { useState, useRef, useCallback } from 'react';
import type { Story, Playthrough, Language, GameSettings } from '../../types';
import { translations } from '../../constants';
import StoryCard from '../../components/StoryCard';
import { PlusIcon, SunIcon, MoonIcon, LogOutIcon, SettingsIcon } from '../../components/icons';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { useAuth } from '../../contexts/AuthContext';
import SettingsModal from '../../components/SettingsModal';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useStories, useDeleteStory } from '../hooks/useStories';
import { usePlaythroughs } from '../hooks/usePlaythroughs';
import { useNavigate } from 'react-router-dom';

// No props needed - everything will be handled via hooks

type ConfirmAction = 
    | { type: 'deleteStory'; id: string; title: string }
    | { type: 'deletePlaythrough'; id: string; title: string };

const ProfilePage: React.FC = () => {
    const { signOut, user } = useAuth();
    const { settings, setSettings } = useUserSettings();
    const navigate = useNavigate();
    const { data: allStories = [], isLoading: storiesLoading } = useStories(user?.id);
    const { data: playthroughs = [], isLoading: playthroughsLoading } = usePlaythroughs(user?.id);
    const deleteStoryMutation = useDeleteStory();

    const t = translations[settings?.language || 'zh'];
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filter for stories created by the current logged-in user.
    const myStories = user && allStories ? allStories.filter(s => s.creatorId === user.id) : [];

    const recentlyPlayedStories = (playthroughs || [])
      .map(p => allStories.find(s => s.id === p.storyId))
      .filter((s): s is Story => s !== undefined);

    // Callback functions
    const handleEdit = useCallback((story?: Story) => {
        // Navigate to create/edit page
        if (story) {
            navigate(`/create?edit=${story.id}`);
        } else {
            navigate('/create');
        }
    }, [navigate]);

    const handlePlay = useCallback((story: Story) => {
        navigate(`/game/${story.id}`);
    }, [navigate]);

    const handleDeleteStory = useCallback(async (storyId: string) => {
        try {
            await deleteStoryMutation.mutateAsync(storyId);
        } catch (error) {
            console.error('Failed to delete story:', error);
        }
    }, [deleteStoryMutation]);

    const handleDeletePlaythrough = useCallback(async (storyId: string) => {
        // TODO: Implement playthrough deletion
        console.log('Delete playthrough for story:', storyId);
    }, []);

    const handleConfirm = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'deleteStory') {
            handleDeleteStory(confirmAction.id);
        } else if (confirmAction.type === 'deletePlaythrough') {
            handleDeletePlaythrough(confirmAction.id);
        }
        setConfirmAction(null);
    };

    const getDialogContent = () => {
        if (!confirmAction) return { title: '', message: '', confirmText: '' };
        switch(confirmAction.type) {
            case 'deleteStory':
                return { 
                    title: t.deleteStoryTitle, 
                    message: `${t.deleteStoryMessage} (Story: ${confirmAction.title})`,
                    confirmText: t.delete
                };
            case 'deletePlaythrough':
                 return { 
                    title: t.deletePlaythroughTitle, 
                    message: `${t.deletePlaythroughMessage} (Story: ${confirmAction.title})`,
                    confirmText: t.delete
                };
            default:
                return { title: '', message: '', confirmText: '' };
        }
    };

    const handleExportSettings = () => {
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = 'gemini-adventure-settings.json';
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    const importedSettings = JSON.parse(result) as GameSettings;
                     if (importedSettings.provider && importedSettings.llm) {
                        setSettings(importedSettings);
                    } else {
                        alert('Invalid settings file format.');
                    }
                }
            } catch (error) {
                console.error('Error importing settings:', error);
                alert('Failed to import settings file.');
            }
        };
        reader.readAsText(file);
        if (e.target) e.target.value = '';
    };

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json" />
            <div className="flex justify-between items-center mb-6">
                <div className="text-sm text-gray-500 dark:text-zinc-400 truncate">
                    {user?.email}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-gray-500 dark:text-zinc-400 hover:text-indigo-500 transition-colors" aria-label={t.settings}>
                        <SettingsIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setSettings(s => ({...s, theme: s?.theme === 'dark' ? 'light' : 'dark'}))} className="p-2 text-gray-500 dark:text-zinc-400 hover:text-indigo-500 transition-colors" aria-label="Toggle theme">
                        {settings?.theme === 'dark' ? <SunIcon className="w-5 h-5"/> : <MoonIcon className="w-5 h-5"/>}
                    </button>
                    <button onClick={() => {
                        console.log('🔥 Sign Out button clicked!');
                        console.log('🔥 signOut function:', signOut);
                        signOut().then(result => {
                            console.log('🔥 signOut result:', result);
                        }).catch(error => {
                            console.error('🔥 signOut error:', error);
                        });
                    }} className="p-2 text-gray-500 dark:text-zinc-400 hover:text-red-500 transition-colors" aria-label="Sign Out">
                        <LogOutIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>

            {/* Recently Played */}
            <section className="mb-10">
                <h2 className="text-2xl font-bold font-serif text-gray-700 dark:text-zinc-300 mb-4">{t.recentlyPlayed}</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recentlyPlayedStories.length > 0 ? (
                        recentlyPlayedStories.map(story => (
                            <div key={story.id} className="relative group">
                               <StoryCard story={story} />
                               <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handlePlay(story)} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">{t.continue}</button>
                                    <button onClick={() => setConfirmAction({type: 'deletePlaythrough', id: story.id, title: story.title})} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">{t.deleteProgress}</button>
                               </div>
                            </div>
                        ))
                    ) : (
                         <div className="col-span-full text-center p-8 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg">
                            <p className="text-gray-500 dark:text-zinc-400">{t.noGamesPlayed}</p>
                            <p className="text-gray-500 dark:text-zinc-400">{t.findAStory}</p>
                        </div>
                    )}
                </div>
            </section>
            
            {/* My Stories */}
            <section>
                 <h2 className="text-2xl font-bold font-serif text-gray-700 dark:text-zinc-300 mb-4">{t.myStories}</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myStories.map(story => (
                        <div key={story.id} className="relative group">
                           <StoryCard story={story} />
                           <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handlePlay(story)} className="px-3 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">Play</button>
                                <button onClick={() => handleEdit(story)} className="px-3 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">{t.edit}</button>
                                <button onClick={() => setConfirmAction({type: 'deleteStory', id: story.id, title: story.title})} className="px-3 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">{t.delete}</button>
                           </div>
                        </div>
                    ))}
                     <button onClick={() => handleEdit()} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-lg hover:border-indigo-500 hover:text-indigo-500 text-gray-500 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors min-h-[160px]">
                        <PlusIcon className="w-8 h-8 mb-2" />
                        <span className="font-semibold">{t.createFirstStory}</span>
                    </button>
                </div>
            </section>
            
            <ConfirmationDialog
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title={getDialogContent().title}
                message={getDialogContent().message}
                confirmText={getDialogContent().confirmText}
                cancelText={t.cancel}
            />

            {isSettingsModalOpen && <SettingsModal
                settings={settings}
                onSave={setSettings}
                onClose={() => setIsSettingsModalOpen(false)}
                onExport={handleExportSettings}
                onImportClick={handleImportClick}
            />}
        </div>
    );
};

export default ProfilePage;