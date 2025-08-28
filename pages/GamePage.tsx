import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameStatus } from '../types';
import type { Scene, HistoryItem, GameSettings, DebugLogEntry, SceneFragment, Memories, MilestoneSummaryItem, Story, Playthrough, DetectedPlaceholder } from '../types';
import { getNextScene, generateImage, generateGrandSummary, evaluateAndGenerateMilestone } from '../services/aiService';
import { translations, simpleUUID } from '../constants';
import SceneDisplay from '../components/SceneDisplay';
import ActionsPanel from '../components/ActionsPanel';
import SummaryPanel from '../components/SummaryPanel';
import GameSettingsPanel from '../components/LLMSettingsPanel';
import Resizer from '../components/Resizer';
import DebugPanel from '../components/DebugPanel';
import { BookIcon, BugIcon, CloseIcon, SlidersIcon, RegenerateIcon as RestartIcon, ArrowLeftIcon } from '../components/icons';
import ConfirmationDialog from '../components/ConfirmationDialog';
import PlaceholderInputModal from '../components/PlaceholderInputModal';

const showDebug = (window as any).DEBUG_MODE === true;

interface GamePageProps {
    settings: GameSettings;
    setSettings: (settings: GameSettings) => void;
    activeStory: Story;
    playthrough?: Playthrough;
    onSavePlaythrough: (playthrough: Playthrough) => void;
    onExit: () => void;
    userId: string;
}

// Simple placeholder replacement, e.g., [[id:Character Name]] -> Character Name
const parseContent = (text: string): string => {
    return text.replace(/\[\[.*?:]/g, '').replace(/\]\]/g, '');
};

export default function GamePage({ settings, setSettings, activeStory, playthrough, onSavePlaythrough, onExit, userId }: GamePageProps): React.ReactNode {
  // This initializer now runs on every new story, thanks to the key in App.tsx
  const [gameState, setGameState] = useState<Omit<Playthrough, 'storyId'>>(() => {
    if (playthrough) {
      return playthrough;
    }
    return {
      userId: userId,
      history: [],
      summaries: [],
      grandSummaries: [],
      milestoneSummaries: [],
      turn: 0,
      userName: 'Player',
      charName: 'Game Master',
      gameStatus: GameStatus.Idle,
    };
  });
  
  const [communicationsLog, setCommunicationsLog] = useState<DebugLogEntry[]>([]);
  
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);
  const [isNewGameConfirmOpen, setIsNewGameConfirmOpen] = useState(false);
  const [isPlaceholderModalOpen, setIsPlaceholderModalOpen] = useState(false);
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<DetectedPlaceholder[]>([]);
  const [processedStory, setProcessedStory] = useState<Story | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Resizable Panel Logic ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [scenePanelSize, setScenePanelSize] = useState(60); // %
  const [isBgLoaded, setIsBgLoaded] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsBgLoaded(false);
    if (!activeStory.coverImageUrl) return;

    const img = new Image();
    img.src = activeStory.coverImageUrl;
    img.onload = () => setIsBgLoaded(true);
  }, [activeStory.coverImageUrl]);

  const handleResize = useCallback(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const startPos = isMobile ? e.clientY : e.clientX;
    const startSize = scenePanelSize;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (!containerRef.current) return;
      const delta = (isMobile ? moveEvent.clientY : moveEvent.clientX) - startPos;
      const containerSize = isMobile ? containerRef.current.offsetHeight : containerRef.current.offsetWidth;
      if (containerSize === 0) return;
      const deltaPercent = (delta / containerSize) * 100;
      const newSize = startSize + deltaPercent;
      setScenePanelSize(Math.max(20, Math.min(newSize, 80)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
  }, [isMobile, scenePanelSize]);
  // --- End Resizable Panel Logic ---

  const t = translations[settings.language];
  const currentModelResponse = gameState.history.length > 0 && gameState.history[gameState.history.length - 1].role === 'model' && !gameState.history[gameState.history.length-1].isError
    ? JSON.parse(gameState.history[gameState.history.length - 1].parts[0].text) as Scene
    : null;

  const logCommunication = useCallback((type: string, data: any) => {
    setCommunicationsLog(prev => [...prev, { type, data, timestamp: new Date().toISOString() }]);
  }, []);

  const startNewSession = useCallback((story: Story, userName?: string, charName?: string) => {
    const openingMonologue = parseContent(story.openingMonologue);
    
    const monologueScene: SceneFragment = {
        description: openingMonologue,
        imagePrompt: '',
        actions: [parseContent(story.openingAction)],
        summary: '',
    };
    const monologueHistoryItem: HistoryItem = {
      role: 'model',
      parts: [{ text: JSON.stringify(monologueScene) }],
      imageUrl: null,
      isGeneratingImage: false,
    };

    setGameState({
      userId: userId,
      history: [monologueHistoryItem],
      summaries: [],
      grandSummaries: [],
      milestoneSummaries: [],
      turn: 0,
      userName: userName || 'Player',
      charName: charName || 'Game Master',
      gameStatus: GameStatus.Playing,
    });
    setCommunicationsLog([]);
  }, [userId]);
  
  const scanForPlaceholders = useCallback((story: Story): DetectedPlaceholder[] => {
    const texts = [
        story.backgroundSetting,
        ...story.library.map(c => c.content),
        story.openingMonologue,
        story.openingAction,
    ];

    const combinedText = texts.join(' ');
    const placeholderRegex = /{{\s*(\w+)(?::\s*([^}]+))?\s*}}/g;
    const placeholders = new Map<string, DetectedPlaceholder>();
    let match;
    while ((match = placeholderRegex.exec(combinedText)) !== null) {
        const key = match[1];
        const description = match[2] || key.charAt(0).toUpperCase() + key.slice(1);
        if (!placeholders.has(key)) {
            placeholders.set(key, { key, description });
        }
    }
    return Array.from(placeholders.values());
  }, []);

  const handlePlaceholderSubmit = useCallback((names: Record<string, string>) => {
      const replacedStory = JSON.parse(JSON.stringify(activeStory));
      
      const replace = (text: string) => {
          let newText = text;
          for (const key in names) {
              if (Object.prototype.hasOwnProperty.call(names, key)) {
                  const regex = new RegExp(`{{\\s*${key}(?::[^}}]+)?\\s*}}`, 'g');
                  newText = newText.replace(regex, names[key]);
              }
          }
          return newText;
      };
      
      replacedStory.backgroundSetting = replace(replacedStory.backgroundSetting);
      replacedStory.openingMonologue = replace(replacedStory.openingMonologue);
      replacedStory.openingAction = replace(replacedStory.openingAction);
      replacedStory.library = replacedStory.library.map(card => ({
          ...card,
          content: replace(card.content),
      }));

      setProcessedStory(replacedStory);
      startNewSession(replacedStory, names.user, names.char);
      
      setIsPlaceholderModalOpen(false);
  }, [activeStory, startNewSession]);

  useEffect(() => {
    if (playthrough) {
      setProcessedStory(activeStory);
    } else {
      const placeholders = scanForPlaceholders(activeStory);
      if (placeholders.length > 0) {
        setDetectedPlaceholders(placeholders);
        setIsPlaceholderModalOpen(true);
      } else {
        setProcessedStory(activeStory);
        startNewSession(activeStory);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
      if (gameState.gameStatus !== GameStatus.Idle || gameState.history.length > 0) {
        onSavePlaythrough({ storyId: activeStory.id, ...gameState });
      }
  }, [gameState, activeStory.id, onSavePlaythrough]);
  

  const processAction = useCallback(async (action: string, currentState: typeof gameState) => {
    if (!processedStory) return;
    
    setGameState(s => ({...s, gameStatus: GameStatus.Loading}));
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const isFirstAction = !currentState.history.some(h => h.role === 'user');
    let settingsToUse = settings;

    if (isFirstAction) {
        const tempInstructions = [...settingsToUse.systemInstructions];
        if (processedStory.backgroundSetting) tempInstructions.unshift({ id: simpleUUID(), title: 'Game Background', role: 'system', text: `Background: ${parseContent(processedStory.backgroundSetting)}`, enabled: true });
        
        processedStory.library.forEach(card => {
            tempInstructions.push({ id: card.id, title: `Library Card: ${card.name}`, role: 'system', text: `[${card.type.toUpperCase()}] ${card.name}: ${card.content}`, enabled: true });
        });
        settingsToUse = { ...settingsToUse, systemInstructions: tempInstructions };
    }
    
    const memories: Memories = {
      summaries: currentState.summaries,
      grandSummaries: currentState.grandSummaries,
      milestoneSummaries: currentState.milestoneSummaries,
    };

    const newTurn = currentState.turn + 1;
    const userAction: HistoryItem = { role: 'user' as const, parts: [{ text: action }] };
    logCommunication('user_action', userAction);
    
    const fullHistory = [...currentState.history, userAction];
    setGameState(s => ({...s, history: fullHistory, turn: newTurn}));

    try {
      const { scene, rawResponse } = await getNextScene(fullHistory, settingsToUse, memories, logCommunication, controller.signal);

      const historyItemInProgress: HistoryItem = {
        role: 'model' as const, parts: [{ text: rawResponse }], imageUrl: null,
        isGeneratingImage: settingsToUse.enableImageGeneration,
      };
      
      setGameState(s => ({
        ...s,
        history: [...s.history, historyItemInProgress],
        summaries: [...s.summaries, scene.summary],
        gameStatus: GameStatus.Playing
      }));

      const updatedHistoryWithModel = [...fullHistory, historyItemInProgress];
      const modelResponseCount = updatedHistoryWithModel.filter(h => h.role === 'model' && !h.isError).length;
      
      if (modelResponseCount > 0 && modelResponseCount % 5 === 0) {
        generateGrandSummary(updatedHistoryWithModel, settingsToUse, logCommunication)
          .then(summaryText => {
            setGameState(s => ({ ...s, grandSummaries: [...s.grandSummaries, { turn: modelResponseCount, text: summaryText }] }));
          }).catch(e => console.error("Failed to generate grand summary:", e));
      }

      const milestoneContext = updatedHistoryWithModel.slice(-4);
      evaluateAndGenerateMilestone(milestoneContext, settingsToUse, logCommunication)
        .then(milestone => {
            if (milestone) {
                setGameState(s => ({ ...s, milestoneSummaries: [...s.milestoneSummaries, { turn: modelResponseCount, ...milestone }] }));
            }
        }).catch(e => console.error("Failed to evaluate milestone:", e));
      
      if (settingsToUse.enableImageGeneration) {
        generateImage(scene.imagePrompt, settingsToUse, logCommunication).then(imageUrl => {
            setGameState(prev => {
                const newHistory = [...prev.history];
                const lastItemIndex = newHistory.length - 1;
                if (lastItemIndex >= 0 && newHistory[lastItemIndex].role === 'model') {
                    newHistory[lastItemIndex] = { ...newHistory[lastItemIndex], imageUrl: imageUrl, isGeneratingImage: false };
                }
                return { ...prev, history: newHistory };
            });
        }).catch(e => {
            console.error(e);
            setGameState(prev => {
                const newHistory = [...prev.history];
                const lastItemIndex = newHistory.length - 1;
                if (lastItemIndex >= 0 && newHistory[lastItemIndex].role === 'model') {
                    newHistory[lastItemIndex].isGeneratingImage = false;
                }
                return { ...prev, history: newHistory };
            });
        });
      }

    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return;

      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      logCommunication('gameplay_error', { message: errorMessage, stack: (e as Error)?.stack });
      const errorItem: HistoryItem = {
        role: 'model' as const, parts: [{ text: JSON.stringify({ title: t.errorTitle, message: errorMessage }) }],
        isError: true, imageUrl: null, isGeneratingImage: false,
      };
      setGameState(s => ({
        ...s,
        history: [...s.history, errorItem],
        gameStatus: GameStatus.Playing,
        turn: currentState.turn, // Revert turn count
      }));
    } finally {
      abortControllerRef.current = null;
    }
  }, [settings, logCommunication, processedStory, t.errorTitle]);

  const handleAction = useCallback(async (action: string) => {
    await processAction(action, gameState);
  }, [gameState, processAction]);
  
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setGameState(s => {
      const historyWithoutUserAction = s.history[s.history.length-1]?.role === 'user' ? s.history.slice(0, -1) : s.history;
      return {
        ...s,
        gameStatus: GameStatus.Playing,
        history: historyWithoutUserAction,
        turn: Math.max(0, s.turn - 1),
      };
    });
  }, []);

  const handleRegenerate = useCallback(async () => {
    const lastUserActionIndex = gameState.history.map(h => h.role).lastIndexOf('user');
    if (lastUserActionIndex === -1) return;

    const lastAction = gameState.history[lastUserActionIndex].parts[0].text;
    const historyForRegen = gameState.history.slice(0, lastUserActionIndex);
    const turnForRegen = historyForRegen.filter(h => h.role === 'user').length;
    
    const modelResponsesBeforeRegen = historyForRegen.filter(h => h.role === 'model' && !h.isError).length;
    const summariesForRegen = gameState.summaries.slice(0, modelResponsesBeforeRegen);
    const grandSummariesForRegen = gameState.grandSummaries.filter(ms => ms.turn <= modelResponsesBeforeRegen);
    const milestoneSummariesForRegen = gameState.milestoneSummaries.filter(ms => ms.turn <= modelResponsesBeforeRegen);

    const stateForRegen = {
      ...gameState,
      history: historyForRegen,
      summaries: summariesForRegen,
      grandSummaries: grandSummariesForRegen,
      milestoneSummaries: milestoneSummariesForRegen,
      turn: turnForRegen,
    };
    
    setGameState(stateForRegen);
    await processAction(lastAction, stateForRegen);

  }, [gameState, processAction]);
  
  const handleConfirmNewGame = () => {
    setIsNewGameConfirmOpen(false);
    const placeholders = scanForPlaceholders(activeStory);
    if (placeholders.length > 0) {
      setDetectedPlaceholders(placeholders);
      setIsPlaceholderModalOpen(true);
    } else {
      setProcessedStory(activeStory);
      startNewSession(activeStory);
    }
  };
    
  const actionsToShow = currentModelResponse?.actions ?? [];

  const windowOpacityFactor = (settings.dialogueWindowOpacity ?? 100) / 100;
  const bubbleOpacityFactor = (settings.bubbleOpacity ?? 100) / 100;
  const gamePanelStyles = {
      '--game-panel-bg-opacity-light': `${0.85 * windowOpacityFactor}`,
      '--game-panel-bg-opacity-dark': `${0.85 * windowOpacityFactor}`,
      '--bubble-opacity': bubbleOpacityFactor,
  } as React.CSSProperties;
  
  const backgroundOverlayOpacity = 0.6 * windowOpacityFactor;
  const backgroundBlur = windowOpacityFactor > 0.05 ? `blur(${windowOpacityFactor * 4}px)` : 'none';

  return (
    <div className="fixed inset-0 flex flex-col bg-cover bg-center bg-zinc-950" style={{ backgroundImage: isBgLoaded ? `url(${activeStory.coverImageUrl})` : 'none'}}>
        <div 
          className="absolute inset-0 z-0 transition-all duration-300"
          style={{
              backgroundColor: `rgba(0, 0, 0, ${backgroundOverlayOpacity})`,
              backdropFilter: backgroundBlur
          }}
        />

        <div style={gamePanelStyles} className="relative z-10 w-full h-full flex flex-col">
            <header className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between gap-2 text-sm" style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))', paddingLeft: 'calc(1rem + env(safe-area-inset-left))', paddingRight: 'calc(1rem + env(safe-area-inset-right))', paddingBottom: '1rem' }}>
                <div className="flex items-center gap-2">
                    <button onClick={onExit} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors" aria-label={t.back}>
                        <ArrowLeftIcon className="w-5 h-5"/>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsGameSettingsOpen(true)} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors" aria-label={t.gameSettings}>
                        <SlidersIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setIsNewGameConfirmOpen(true)} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors" aria-label={t.startNewGame}>
                        <RestartIcon className="w-5 h-5"/>
                    </button>
                    <button onClick={() => setIsSummaryOpen(true)} disabled={gameState.history.length === 0} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={t.storyLog}>
                        <BookIcon className="w-5 h-5"/>
                    </button>
                    {showDebug && (
                    <button onClick={() => setIsDebugPanelOpen(true)} disabled={gameState.history.length === 0} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={t.debugLog}>
                        <BugIcon className="w-5 h-5"/>
                    </button>
                    )}
                </div>
            </header>
            
            <div
              ref={containerRef}
              className="flex-grow flex flex-col lg:flex-row h-full min-h-0 px-4 md:px-6"
              style={{
                paddingTop: 'calc(4rem + env(safe-area-inset-top))',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
                <div style={{ flexBasis: isMobile ? `${scenePanelSize}%` : `${scenePanelSize}%` }} className="flex flex-col min-h-0 min-w-0">
                <SceneDisplay
                    history={gameState.history}
                    onRegenerate={handleRegenerate}
                    isLoading={gameState.gameStatus === GameStatus.Loading}
                    regenerateLabel={t.regenerate}
                    userName={gameState.userName}
                    charName={gameState.charName}
                />
                </div>
                <Resizer onMouseDown={handleMouseDown} isHorizontal={!isMobile} />
                <div style={{ flexBasis: isMobile ? `${100 - scenePanelSize}%` : `${100-scenePanelSize}%` }} className="flex flex-col min-h-0 min-w-0">
                <ActionsPanel
                    actions={actionsToShow}
                    onAction={handleAction}
                    onStop={handleStopGeneration}
                    disabled={gameState.gameStatus === GameStatus.Idle}
                    gameStatus={gameState.gameStatus}
                    userName={gameState.userName}
                    language={settings.language}
                />
                </div>
            </div>

            {isSummaryOpen && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-2xl h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
                            <h2 className="text-xl font-bold text-gray-700 dark:text-zinc-300 font-serif">{t.summariesHeader}</h2>
                            <button onClick={() => setIsSummaryOpen(false)} className="p-1 text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 rounded-full">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-grow min-h-0">
                             <SummaryPanel summaries={gameState.summaries} grandSummaries={gameState.grandSummaries} milestoneSummaries={gameState.milestoneSummaries} headerText="" />
                        </div>
                    </div>
                </div>
            )}
            
            {showDebug && <DebugPanel
                isOpen={isDebugPanelOpen}
                onClose={() => setIsDebugPanelOpen(false)}
                log={communicationsLog}
                language={settings.language}
            />}
            
            {isGameSettingsOpen && (
                <div className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setIsGameSettingsOpen(false)} />
            )}
            <div className={`absolute top-0 right-0 h-full w-full max-w-sm z-50 transition-transform duration-300 ease-in-out ${isGameSettingsOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <GameSettingsPanel 
                    settings={settings} 
                    onSettingsChange={setSettings} 
                    onClose={() => setIsGameSettingsOpen(false)} 
                />
            </div>

            <ConfirmationDialog
                isOpen={isNewGameConfirmOpen}
                onClose={() => setIsNewGameConfirmOpen(false)}
                onConfirm={handleConfirmNewGame}
                title={t.restartGameTitle}
                message={t.restartGameMessage}
                confirmText={t.restart}
                cancelText={t.cancel}
            />

            {isPlaceholderModalOpen && <PlaceholderInputModal 
                isOpen={isPlaceholderModalOpen}
                onClose={onExit}
                onSubmit={handlePlaceholderSubmit}
                placeholders={detectedPlaceholders}
                language={settings.language}
            />}
        </div>
    </div>
  );
}