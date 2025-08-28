import React, { useState, useEffect, useCallback } from 'react';
import type { Page, GameSettings, Story, Playthrough, StoryFromDB, PlaythroughFromDB } from './types';
import { DEFAULT_SETTINGS } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import BottomNavBar from './components/BottomNavBar';
import TopHeader from './components/TopHeader';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import CreatePage from './pages/CreatePage';
import ProfilePage from './pages/ProfilePage';
import GamePage from './pages/GamePage';
import LoadingOverlay from './components/LoadingOverlay';
import AuthPage from './pages/AuthPage';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabaseClient';


// --- Data Transformation Helpers ---
// Converts a story object from snake_case (DB) to camelCase (App)
const storyFromDb = (dbStory: StoryFromDB): Story => ({
    id: dbStory.id,
    creatorId: dbStory.creator_id,
    creatorName: dbStory.creator_name,
    title: dbStory.title,
    description: dbStory.description,
    coverImageUrl: dbStory.cover_image_url,
    visibility: dbStory.visibility,
    category: dbStory.category,
    library: dbStory.library,
    backgroundSetting: dbStory.background_setting,
    openingMonologue: dbStory.opening_monologue,
    openingAction: dbStory.opening_action,
    openingSpeaker: dbStory.opening_speaker,
});

// Converts a story object from camelCase (App) to snake_case (DB)
const storyToDb = (appStory: Story): Omit<StoryFromDB, 'creator_id'> & { creator_id?: string } => ({
    id: appStory.id,
    creator_id: appStory.creatorId,
    creator_name: appStory.creatorName,
    title: appStory.title,
    description: appStory.description,
    cover_image_url: appStory.coverImageUrl,
    visibility: appStory.visibility,
    category: appStory.category,
    library: appStory.library,
    background_setting: appStory.backgroundSetting,
    opening_monologue: appStory.openingMonologue,
    opening_action: appStory.openingAction,
    opening_speaker: appStory.openingSpeaker,
});

// Converts a playthrough object from snake_case (DB) to camelCase (App)
const playthroughFromDb = (dbPlaythrough: PlaythroughFromDB): Playthrough => ({
    id: dbPlaythrough.id,
    storyId: dbPlaythrough.story_id,
    userId: dbPlaythrough.user_id,
    ...dbPlaythrough.game_state
});

export default function App(): React.ReactNode {
  const { session, user, loading } = useAuth();
  const [settings, setSettings] = useLocalStorage<GameSettings>('gemini-adventure-settings-v2', DEFAULT_SETTINGS);
  const [stories, setStories] = useState<Story[]>([]);
  const [playthroughs, setPlaythroughs] = useState<Playthrough[]>([]);
  
  const [activePage, setActivePage] = useState<Page>('home');
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [storyToEdit, setStoryToEdit] = useState<Story | null>(null);

  useEffect(() => {
    const fetchStories = async () => {
        const { data, error } = await supabase
            .from('stories')
            .select('*')
            .order('title');
            
        if (error) {
            console.error('Error fetching stories:', error);
        } else {
            setStories(data.map(storyFromDb));
        }
    };

    const fetchPlaythroughs = async () => {
        if (session) {
            const { data, error } = await supabase
                .from('playthroughs')
                .select('id, story_id, user_id, game_state');

            if (error) {
                console.error('Error fetching playthroughs:', error);
            } else if (data) {
                setPlaythroughs(data.map(playthroughFromDb));
            }
        } else {
            setPlaythroughs([]);
        }
    };

    fetchStories();
    fetchPlaythroughs();
  }, [session]);
  
  // Ensures a user profile exists. If not, creates one.
  useEffect(() => {
    const setupUserProfile = async () => {
      if (user) {
        // Check if a profile exists for the user.
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        // If no profile exists, create one.
        if (!profile) {
          const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            username: user.email?.split('@')[0] || `user_${user.id.substring(0, 8)}`,
          });

          if (insertError) {
            console.error('Error creating user profile:', insertError);
          }
        }
      }
    };
    
    // Run the setup when the user session is available.
    if (session) {
      setupUserProfile();
    }
  }, [session, user]);


  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    root.style.fontSize = `${settings.uiScale}%`;

  }, [settings.theme, settings.uiScale]);

  const handleOpenCreate = (story?: Story) => {
    setStoryToEdit(story || null);
    setIsCreateOpen(true);
  };

  const handleSaveStory = async (storyToSave: Story) => {
    if (!user) return;

    const storyWithCreatorInfo: Story = {
      ...storyToSave,
      creatorId: user.id,
      creatorName: storyToSave.creatorName === 'You' || !storyToSave.creatorName 
        ? user.email?.split('@')[0] || 'Anonymous' 
        : storyToSave.creatorName,
    };
    
    const dbPayload = storyToDb(storyWithCreatorInfo);

    const { data, error } = await supabase
        .from('stories')
        .upsert(dbPayload)
        .select()
        .single();
    
    if (error) {
        console.error("Error saving story:", error);
    } else if (data) {
        const savedStory = storyFromDb(data);
        setStories(prev => {
            const index = prev.findIndex(s => s.id === savedStory.id);
            if (index > -1) {
                const newStories = [...prev];
                newStories[index] = savedStory;
                return newStories;
            }
            return [...prev, savedStory];
        });
    }
    setIsCreateOpen(false);
  };

  const handleDeleteStory = async (storyId: string) => {
    const { error: storyError } = await supabase.from('stories').delete().eq('id', storyId);

    if (storyError) {
      console.error("Error deleting story:", storyError);
    } else {
      setStories(prev => prev.filter(s => s.id !== storyId));
      setPlaythroughs(prev => prev.filter(p => p.storyId !== storyId));
      // Deleting associated playthroughs happens via CASCADE constraint in DB.
    }
  };

  const handlePlayStory = (story: Story) => {
    setActiveStory(story);
    setActivePage('game');
  };
  
  const handleNavigation = (page: Page | 'create') => {
    if (page === 'create') {
      handleOpenCreate();
    } else {
      if (page !== 'game') {
          setActiveStory(null);
      }
      setActivePage(page);
    }
  };
  
  const handleSavePlaythrough = useCallback(async (playthrough: Playthrough) => {
      if (!user) return;
      
      // Destructure to separate the game state from identifiers
      const { id, storyId, userId, ...gameState } = playthrough;
      
      // The record to upsert. We don't include 'id' because the upsert
      // is based on the user_id and story_id conflict resolution.
      const recordToUpsert = {
          story_id: storyId,
          user_id: user.id,
          game_state: gameState,
      };

      // Upsert the record. If a row with the same user_id and story_id
      // exists, it will be updated. Otherwise, a new row will be inserted.
      const { data, error } = await supabase
        .from('playthroughs')
        .upsert(recordToUpsert, {
            onConflict: 'user_id, story_id',
        })
        .select('id, story_id, user_id, game_state')
        .single();

      if (error) {
        // Improved error logging
        console.error("Error saving playthrough:", error.message, error);
      } else if (data) {
        const savedPlaythrough = playthroughFromDb(data);
        setPlaythroughs(prev => {
            // Find the playthrough using the unique combination of storyId and userId
            const index = prev.findIndex(p => p.storyId === savedPlaythrough.storyId && p.userId === savedPlaythrough.userId);
            
            if (index > -1) {
                // If found, update it in the array
                const newPlaythroughs = [...prev];
                newPlaythroughs[index] = savedPlaythrough;
                return newPlaythroughs;
            } else {
                // If not found, add the new playthrough to the array
                return [...prev, savedPlaythrough];
            }
        });
      }
  }, [user]);

  const handleDeletePlaythrough = async (storyId: string) => {
      if (!user) return;
      const { error } = await supabase.from('playthroughs').delete().match({ story_id: storyId, user_id: user.id });
      
      if (error) {
          console.error("Error deleting playthrough:", error);
      } else {
          setPlaythroughs(prev => prev.filter(p => !(p.storyId === storyId && p.userId === user.id)));
      }
  };


  const renderActivePage = () => {
    switch (activePage) {
      case 'home':
        return <HomePage settings={settings} stories={stories.filter(s => s.visibility === 'public')} onPlay={handlePlayStory} />;
      case 'explore':
        return <ExplorePage settings={settings} stories={stories.filter(s => s.visibility === 'public')} onPlay={handlePlayStory} />;
      case 'profile':
        return <ProfilePage
                  settings={settings}
                  setSettings={setSettings}
                  stories={stories}
                  playthroughs={playthroughs}
                  onEdit={handleOpenCreate}
                  onDeleteStory={handleDeleteStory}
                  onPlay={handlePlayStory}
                  onDeletePlaythrough={handleDeletePlaythrough}
                />;
      case 'game':
        if (!activeStory) {
          return <LoadingOverlay messages={['Loading Story...']} />;
        }
        const playthroughForStory = playthroughs.find(p => p.storyId === activeStory.id && p.userId === user?.id);
        return <GamePage
                  key={activeStory.id}
                  settings={settings}
                  setSettings={setSettings}
                  activeStory={activeStory}
                  playthrough={playthroughForStory}
                  onSavePlaythrough={handleSavePlaythrough}
                  onExit={() => { setActiveStory(null); setActivePage('home'); }}
                  userId={user!.id}
                />;
      default:
        return <HomePage settings={settings} stories={stories} onPlay={handlePlayStory} />;
    }
  };
  
  if (loading) {
    return <LoadingOverlay messages={['Initializing Session...']} />;
  }

  if (!session) {
    return <AuthPage />;
  }
  
  const isGameActive = activePage === 'game';

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-950 text-gray-800 dark:text-zinc-200">
      {isGameActive ? (
         renderActivePage()
      ) : (
        <>
            <TopHeader activePage={activePage} language={settings.language} />
            <main className="h-full overflow-y-auto main-content-area" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>
                {renderActivePage()}
            </main>
            <BottomNavBar
                activePage={activePage}
                onNavigate={handleNavigation}
                language={settings.language}
            />
        </>
      )}

      {isCreateOpen && (
        <CreatePage
          storyToEdit={storyToEdit}
          onSave={handleSaveStory}
          onClose={() => setIsCreateOpen(false)}
          settings={settings}
        />
      )}
    </div>
  );
}