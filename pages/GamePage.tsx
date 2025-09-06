import React, { useCallback, useEffect, useRef, useState } from 'react';
import ActionsPanel from '../components/ActionsPanel';
import ConfirmationDialog from '../components/ConfirmationDialog';
import DebugPanel from '../components/DebugPanel';
import DialogueModal from '../components/DialogueModal';
import { ArrowLeftIcon, BookIcon, BugIcon, CloseIcon, MapIcon, RegenerateIcon as RestartIcon, SlidersIcon } from '../components/icons';
import GameSettingsPanel from '../components/LLMSettingsPanel';
import MapViewerModal from '../components/MapViewerModal';
import PlaceholderInputModal from '../components/PlaceholderInputModal';
import Resizer from '../components/Resizer';
import SceneDisplay from '../components/SceneDisplay';
import SummaryPanel from '../components/SummaryPanel';
import { simpleUUID, translations } from '../constants';
import { evaluateAndGenerateMilestone, generateImage, getNextSceneWithGameEngine, getNextSceneWithTools, type ToolHandler } from '../services/aiService';
import type { DebugLogEntry, DetectedPlaceholder, GameSettings, HistoryItem, Memories, Playthrough, Scene, SceneFragment, Story } from '../types';
import { GameStatus } from '../types';

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
      dialogue: null,
      placeholderValues: {},
    };
  });
  
  const [communicationsLog, setCommunicationsLog] = useState<DebugLogEntry[]>([]);
  
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);
  const [isNewGameConfirmOpen, setIsNewGameConfirmOpen] = useState(false);
  const [isPlaceholderModalOpen, setIsPlaceholderModalOpen] = useState(false);
  const [isMapViewerOpen, setIsMapViewerOpen] = useState(false);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<DetectedPlaceholder[]>([]);
  const [lastPlaceholderValues, setLastPlaceholderValues] = useState<Record<string, string>>(() => {
    // Initialize with values from playthrough if available
    return playthrough?.placeholderValues || {};
  });
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

  // Detect maps in the story
  const storyMaps = processedStory?.library.filter(card => card.type === 'map' && card.mapImageUrl) || [];
  const hasMapButton = storyMaps.length > 0;

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

    setGameState(prev => ({
      userId: userId,
      history: [monologueHistoryItem],
      summaries: [],
      grandSummaries: [],
      milestoneSummaries: [],
      turn: 0,
      userName: userName || 'Player',
      charName: charName || 'Game Master',
      gameStatus: GameStatus.Playing,
      dialogue: null,
      placeholderValues: prev.placeholderValues || {},
    }));
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
      // Save the values for next time
      setLastPlaceholderValues(names);
      
      // Update gameState with placeholder values for persistence
      setGameState(prev => ({
        ...prev,
        placeholderValues: names
      }));
      
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

  const handlePlaceholderCancel = useCallback(() => {
      setIsPlaceholderModalOpen(false);
      // Don't call onExit, just close the modal and stay in the game
  }, []);

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
  

  const processAction = async (action: string, currentState: typeof gameState, customSettings?: GameSettings, silent?: boolean) => {
    if (!processedStory) return;
    
    setGameState(s => ({...s, gameStatus: GameStatus.Loading}));
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const isFirstAction = !currentState.history.some(h => h.role === 'user');
    let settingsToUse = customSettings || settings;

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
    
    // Only add to visible history if not silent
    const fullHistory = silent ? currentState.history : [...currentState.history, userAction];
    const historyForAPI = [...currentState.history, userAction]; // Always include in API call
    
    if (!silent) {
      setGameState(s => ({...s, history: fullHistory, turn: newTurn}));
    } else {
      setGameState(s => ({...s, gameStatus: GameStatus.Loading}));
    }

    try {
      // Choose between new Game Engine or legacy system
      // For now, use Game Engine if dialog tools are enabled and it's a custom provider
      const useGameEngine = settingsToUse.enableDialogueTools && settingsToUse.provider === 'custom';
      
      let result;
      if (useGameEngine) {
        console.log('🎮 Using new Game Engine...');
        result = await getNextSceneWithGameEngine(historyForAPI, settingsToUse, memories, activeStory, logCommunication, controller.signal, toolHandler);
        
        // Debug player location
        if (result.playerLocationData) {
          console.log('🎯 Updating gameState with playerLocationData:', result.playerLocationData);
        }
        
        // Handle dialogue-only interaction to avoid empty bubble
        if (result.toolCalls?.some(tc => tc.function?.name === 'show_dialogue')) {
          // Set actions for dialogue completion
          if (result.actionData?.actions) {
            dialogueActionsRef.current = result.actionData.actions;
            console.log('🎯 Set dialogueActionsRef from GameEngine for dialogue:', result.actionData.actions);
          }
          
          // Update player location if available, but don't add empty scene to history
          const playerLocationToUpdate = result.playerLocationData ? {
            mapId: result.playerLocationData.mapId,
            locationId: result.playerLocationData.locationId
          } : null;
          
          setGameState(s => ({
            ...s,
            gameStatus: GameStatus.Playing,
            ...(playerLocationToUpdate && {
              playerLocation: playerLocationToUpdate
            })
          }));
          
          console.log('🎭 Dialogue interaction handled without adding empty scene to history');
          return; // Exit early to prevent adding minimal scene
        }
        
        // Fix for dialogue actions not being set when scene exists (minimalScene for dialogue)
        if (result.actionData?.actions && result.toolCalls?.some(tc => tc.function?.name === 'show_dialogue')) {
          dialogueActionsRef.current = result.actionData.actions;
          console.log('🎯 Set dialogueActionsRef from GameEngine actionData:', result.actionData.actions);
        }
      } else {
        console.log('🔄 Using legacy system...');
        result = await getNextSceneWithTools(historyForAPI, settingsToUse, memories, logCommunication, controller.signal, toolHandler);
      }
      
      // Check if we have a scene to display (from either tool calls or regular generation)
      if (!result.scene) {
        // If no scene but tools were called, this might be a dialogue-only interaction
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log('🎭 Tools executed without scene generation (dialogue-only interaction)');
          
          // Update actions from GameEngine result if available
          let actionsToUpdate = null;
          let playerLocationToUpdate = null;
          
          if (result.actionData?.actions) {
            actionsToUpdate = result.actionData.actions;
            console.log('🎯 actionData from GameEngine:', result.actionData);
            // Store actions for dialogue completion
            dialogueActionsRef.current = actionsToUpdate;
          }

          if (result.playerLocationData) {
            playerLocationToUpdate = {
              mapId: result.playerLocationData.mapId,
              locationId: result.playerLocationData.locationId
            };
            console.log('playerLocationData from GameEngine:', result.playerLocationData);
          }
          
          // Create a temporary scene with the new actions for UI display
          if (actionsToUpdate) {
            const tempScene: SceneFragment = {
              description: '', // Empty since dialogue is showing
              imagePrompt: '',
              actions: actionsToUpdate,
              summary: '对话交互中'
            };
            
            const tempHistoryItem: HistoryItem = {
              role: 'model',
              parts: [{ text: JSON.stringify(tempScene) }],
              imageUrl: null,
              isGeneratingImage: false,
            };
            
            console.log('🎯 Creating temp scene with actions:', actionsToUpdate);
            
            setGameState(s => ({
              ...s,
              gameStatus: GameStatus.Playing,
              // Add the temp history item to show new actions
              history: [...s.history, tempHistoryItem],
              ...(playerLocationToUpdate && {
                playerLocation: playerLocationToUpdate
              })
            }));
          } else {
            setGameState(s => ({
              ...s,
              gameStatus: GameStatus.Playing,
              ...(playerLocationToUpdate && {
                playerLocation: playerLocationToUpdate
              })
            }));
          }
          return;
        }
        throw new Error("No scene or tool calls returned from AI");
      }
      
      const { scene, rawResponse, playerLocationData } = result;

      const historyItemInProgress: HistoryItem = {
        role: 'model' as const, parts: [{ text: JSON.stringify(scene) }], imageUrl: null,
        isGeneratingImage: settingsToUse.enableImageGeneration,
        mapData: result.mapData, // 包含地图数据供AI后续使用
      };
      
      setGameState(s => ({
        ...s,
        history: silent ? [...fullHistory, historyItemInProgress] : [...s.history, historyItemInProgress],
        summaries: [...s.summaries, scene.summary],
        gameStatus: GameStatus.Playing,
        turn: newTurn,
        ...(playerLocationData && {
          playerLocation: {
            mapId: playerLocationData.mapId,
            locationId: playerLocationData.locationId
          }
        }),
        ...(result.mapData && {
          // 存储地图数据到游戏状态，供后续使用
          mapData: result.mapData
        })
      }));

      const updatedHistoryWithModel = [...fullHistory, historyItemInProgress];
      const modelResponseCount = updatedHistoryWithModel.filter(h => h.role === 'model' && !h.isError).length;
      

      // Only use legacy milestone evaluation if NOT using Game Engine
      // The Game Engine handles milestone evaluation through the evaluate_milestone tool
      if (!useGameEngine) {
        const milestoneContext = updatedHistoryWithModel.slice(-4);
        evaluateAndGenerateMilestone(milestoneContext, settingsToUse, logCommunication)
          .then(milestone => {
              if (milestone) {
                  setGameState(s => ({ ...s, milestoneSummaries: [...s.milestoneSummaries, { turn: modelResponseCount, ...milestone }] }));
              }
          }).catch(e => console.error("Failed to evaluate milestone:", e));
      }
      
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
      let errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      
      // Check if it's a GameEngine error with specific message
      if (result && (result as any).error) {
        errorMessage = (result as any).errorMessage || 'AI未能正确生成响应，请尝试其他行动。';
      }
      
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
  };

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

  // Dialogue handling functions
  const handleDialogueNext = useCallback(() => {
    if (!gameState.dialogue) return;
    
    const newIndex = gameState.dialogue.currentIndex + 1;
    setGameState(prev => ({
      ...prev,
      dialogue: prev.dialogue ? {
        ...prev.dialogue,
        currentIndex: newIndex
      } : null
    }));
  }, [gameState.dialogue]);

  const handleDialogueSkip = useCallback(() => {
    if (!gameState.dialogue) return;
    
    // Complete the dialogue and add to history
    const dialogueContent = `**${gameState.dialogue.speaker}**: ${gameState.dialogue.messages.join('\n\n')}`;
    const dialogueHistoryItem: HistoryItem = {
      role: 'model',
      parts: [{ text: JSON.stringify({ description: dialogueContent, imagePrompt: '', actions: [], summary: `对话与${gameState.dialogue.speaker}` }) }],
      imageUrl: null,
      isGeneratingImage: false,
    };

    setGameState(prev => ({
      ...prev,
      history: [...prev.history, dialogueHistoryItem],
      dialogue: null,
    }));
  }, [gameState.dialogue]);

  const handleDialogueComplete = useCallback(() => {
    if (!gameState.dialogue) return;
    
    // Use actions from tool results if available, otherwise use default actions
    const actionsToUse = dialogueActionsRef.current || [
      '继续探索',
      '询问更多信息', 
      '告别并离开'
    ];

    // Add dialogue to history and clear dialogue state
    const dialogueContent = `**${gameState.dialogue.speaker}**: ${gameState.dialogue.messages.join('\\n\\n')}`;
    const dialogueHistoryItem: HistoryItem = {
      role: 'model',
      parts: [{ text: JSON.stringify({ 
        description: dialogueContent, 
        imagePrompt: '', 
        actions: actionsToUse, 
        summary: `对话与${gameState.dialogue.speaker}` 
      }) }],
      imageUrl: null,
      isGeneratingImage: false,
    };

    // Update state with dialogue in history  
    setGameState(prev => ({
      ...prev,
      history: [...prev.history, dialogueHistoryItem],
      dialogue: null,
    }));
    
    // Clear the stored actions after use
    dialogueActionsRef.current = null;
    
    // No automatic continuation - let player choose what to do next
  }, [gameState.dialogue]);;

  // Store dialogue actions from tool results
  const dialogueActionsRef = useRef<string[] | null>(null);

  // Tool handler for AI function calls
  const toolHandler: ToolHandler = {
    show_dialogue: async (args: { speaker: string; messages: string[]; avatar?: string }) => {
      return new Promise<void>((resolve) => {
        const callbackId = `dialogue-${Date.now()}`;
        
        setGameState(prev => ({
          ...prev,
          dialogue: {
            isActive: true,
            messages: args.messages,
            currentIndex: 0,
            speaker: args.speaker,
            avatar: args.avatar,
            callbackId
          }
        }));

        // Store the resolve callback for when dialogue completes
        const originalComplete = handleDialogueComplete;
        const wrappedComplete = () => {
          originalComplete();
          resolve();
        };
        
        // We'll resolve immediately for now, but this could be enhanced 
        // to wait for actual dialogue completion
        setTimeout(resolve, 100);
      });
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
                    {hasMapButton && (
                        <button
                            onClick={() => {
                                if (gameState.playerLocation && storyMaps.length > 0) {
                                    const playerMapIndex = storyMaps.findIndex(map => map.id === gameState.playerLocation!.mapId);
                                    if (playerMapIndex !== -1) {
                                        setCurrentMapIndex(playerMapIndex);
                                    }
                                }
                                setIsMapViewerOpen(true);
                            }}
                            className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors"
                            aria-label={t.viewMaps}
                        >
                            <MapIcon className="w-5 h-5"/>
                        </button>
                    )}
                    {showDebug && (
                    <>
                    <button onClick={() => setIsDebugPanelOpen(true)} disabled={gameState.history.length === 0} className="p-2 text-gray-200 hover:text-white bg-black/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label={t.debugLog}>
                        <BugIcon className="w-5 h-5"/>
                    </button>
                    {/* Debug mode dialogue test button */}
                    <button 
                        onClick={() => setGameState(prev => ({
                            ...prev,
                            dialogue: {
                                isActive: true,
                                messages: ["欢迎来到这个神秘的村庄！", "这里发生了一些奇怪的事情...", "你能帮助我们找到真相吗？"],
                                currentIndex: 0,
                                speaker: "村长",
                                callbackId: "debug-dialogue-test"
                            }
                        }))} 
                        className="p-2 text-gray-200 hover:text-white bg-purple-600/50 rounded-full transition-colors" 
                        aria-label="测试对话"
                    >
                        <span className="text-xs">对话</span>
                    </button>
                    </>
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
                onClose={handlePlaceholderCancel}
                onSubmit={handlePlaceholderSubmit}
                placeholders={detectedPlaceholders}
                language={settings.language}
                initialValues={lastPlaceholderValues}
            />}

            {gameState.dialogue && (
                <DialogueModal
                    isOpen={gameState.dialogue.isActive}
                    messages={gameState.dialogue.messages}
                    currentIndex={gameState.dialogue.currentIndex}
                    speaker={gameState.dialogue.speaker}
                    avatar={gameState.dialogue.avatar}
                    onNext={handleDialogueNext}
                    onSkip={handleDialogueSkip}
                    onComplete={handleDialogueComplete}
                />
            )}

            {hasMapButton && (
                <MapViewerModal
                    isOpen={isMapViewerOpen}
                    onClose={() => setIsMapViewerOpen(false)}
                    maps={storyMaps}
                    currentMapIndex={currentMapIndex}
                    onMapChange={setCurrentMapIndex}
                    playerLocation={gameState.playerLocation}
                    language={settings.language}
                />
            )}
        </div>
    </div>
  );
}